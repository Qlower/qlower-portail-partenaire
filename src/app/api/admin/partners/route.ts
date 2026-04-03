import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET all partners (admin only - service_role bypasses RLS)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new partner (admin only)
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await request.json();

  const { id, nom, email, type, contrat, code, utm, comm_rules, comm_obj_annuel, user_id } = body;

  if (!id || !nom || !code || !utm) {
    return NextResponse.json(
      { error: "id, nom, code, and utm are required" },
      { status: 400 }
    );
  }

  // Use provided user_id, or look up by email, or create new auth user
  let userId = user_id || null;
  if (!userId && email) {
    // Try to find existing user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users?.users?.find((u) => u.email === email);
    if (existing) {
      userId = existing.id;
      // Update their metadata with partner_id
      await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: { partner_id: id },
      });
    } else {
      // Create new auth user (admin flow)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nom, partner_id: id },
      });
      if (authError) {
        return NextResponse.json(
          { error: `Auth user creation failed: ${authError.message}` },
          { status: 500 }
        );
      }
      userId = authUser.user.id;
    }
  }

  const { data, error } = await supabase.from("partners").insert({
    id,
    user_id: userId,
    nom,
    email,
    type: type || "autre",
    contrat: contrat || "affiliation",
    code,
    utm,
    comm_rules: comm_rules || [],
    comm_obj_annuel: comm_obj_annuel || 500,
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync to HubSpot: add enum value + create automation workflow
  const HS_TOKEN = process.env.HUBSPOT_TOKEN;
  if (HS_TOKEN && utm) {
    const HS_BASE = "https://api.hubapi.com";
    const hsHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };

    try {
      // 1. Add UTM value to partenaire__lead_ enum
      const propRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
        headers: hsHeaders,
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        const options = propData.options || [];
        if (!options.some((o: { value: string }) => o.value === utm)) {
          options.push({ label: nom, value: utm, displayOrder: -1, hidden: false });
          await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
            method: "PATCH",
            headers: hsHeaders,
            body: JSON.stringify({ options }),
          });
        }
      }

      // 2. Create automation workflow to auto-tag contacts with this partner's UTM
      await fetch(`${HS_BASE}/automation/v4/flows`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({
          name: `Auto-tag partenaire: ${nom}`,
          type: "CONTACT",
          enabled: true,
          triggers: [{
            filterBranch: {
              filterBranchType: "AND",
              filters: [{ property: "utm_source", operator: "EQ", value: utm }],
            },
          }],
          actions: [{
            type: "SET_CONTACT_PROPERTY",
            propertyName: "partenaire__lead_",
            propertyValue: utm,
          }],
        }),
      }).catch(() => {}); // Non-blocking if workflow creation fails
    } catch (e) {
      console.error("HubSpot sync error on partner create:", e);
    }
  }

  // AUTO-SYNC: Fetch HubSpot contacts for this partner's UTM
  if (HS_TOKEN && utm) {
    try {
      const syncHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };
      const SYNC_PROPERTIES = [
        "firstname", "lastname", "email", "phone",
        "partenaire__lead_", "utm_source",
        "hs_lifecyclestage", "lifecyclestage",
        "hs_v2_date_entered_999998694",
      ];
      const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
      let afterCursor: string | undefined;
      do {
        const searchBody: Record<string, unknown> = {
          filterGroups: [{ filters: [{ propertyName: "partenaire__lead_", operator: "EQ", value: utm }] }],
          properties: SYNC_PROPERTIES,
          limit: 100,
          ...(afterCursor ? { after: afterCursor } : {}),
        };
        const searchRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/search`, {
          method: "POST",
          headers: syncHeaders,
          body: JSON.stringify(searchBody),
        });
        if (!searchRes.ok) break;
        const searchData = await searchRes.json();
        for (const c of searchData.results || []) {
          contacts.push({ id: c.id, properties: c.properties });
        }
        afterCursor = searchData.paging?.next?.after;
      } while (afterCursor);

      for (const contact of contacts) {
        const props = contact.properties;
        const cNom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
        const cEmail = props.email || "";
        if (!cEmail) continue;
        const lc = (props.lifecyclestage || props.hs_lifecyclestage || "").toLowerCase();
        const stage = lc === "999998694" ? "Abonne" : ["customer", "evangelist"].includes(lc) ? "Payeur" : "Non payeur";
        const commissionDue = !!props.hs_v2_date_entered_999998694;
        const { data: existingLead } = await supabase.from("leads").select("id, commission_due").eq("partner_id", id).eq("email", cEmail).maybeSingle();
        if (existingLead) {
          await supabase.from("leads").update({ stage, hs_contact_id: contact.id, commission_due: existingLead.commission_due || commissionDue }).eq("id", existingLead.id);
        } else {
          await supabase.from("leads").insert({
            partner_id: id, nom: cNom, email: cEmail, source: "UTM", stage,
            mois: new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
            biens: 0, hs_contact_id: contact.id, commission_due: commissionDue,
          });
          await supabase.rpc("increment_partner_leads", { p_id: id });
        }
      }
    } catch (e) {
      console.error("HubSpot contact sync error on partner create:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE partner (admin only) — moves leads to another partner with same UTM if exists
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const moveTo = searchParams.get("move_to"); // optional: partner ID to move leads to

  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  let leadsMoved = 0;

  if (moveTo) {
    // Move leads from deleted partner to target partner (skip duplicates by email)
    const { data: leads } = await supabase
      .from("leads")
      .select("id, email")
      .eq("partner_id", id);

    for (const lead of leads || []) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("partner_id", moveTo)
        .eq("email", lead.email)
        .maybeSingle();

      if (existing) {
        await supabase.from("leads").delete().eq("id", lead.id);
      } else {
        await supabase.from("leads").update({ partner_id: moveTo }).eq("id", lead.id);
        leadsMoved++;
      }
    }

    // Move partner_actions too
    await supabase.from("partner_actions").update({ partner_id: moveTo }).eq("partner_id", id);

    // Recount leads for target partner
    const { count: leadCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", moveTo);
    const { count: abonnesCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", moveTo)
      .eq("stage", "Abonne");
    await supabase.from("partners").update({ leads: leadCount || 0, abonnes: abonnesCount || 0 }).eq("id", moveTo);
  } else {
    // Delete all leads for this partner
    await supabase.from("leads").delete().eq("partner_id", id);
    await supabase.from("partner_actions").delete().eq("partner_id", id);
  }

  // Delete partner
  const { error } = await supabase.from("partners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id, leadsMoved });
}

// PATCH update partner (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Get current partner to detect UTM/name changes
  const { data: current } = await supabase.from("partners").select("utm, nom").eq("id", id).single();

  const { data, error } = await supabase
    .from("partners")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync to HubSpot if UTM or name changed
  const HS_TOKEN = process.env.HUBSPOT_TOKEN;
  const newUtm = updates.utm || current?.utm;
  const newNom = updates.nom || current?.nom;
  const utmChanged = updates.utm && updates.utm !== current?.utm;
  const nomChanged = updates.nom && updates.nom !== current?.nom;

  if (HS_TOKEN && (utmChanged || nomChanged)) {
    try {
      // Fetch current enum options
      const propRes = await fetch("https://api.hubapi.com/crm/v3/properties/contacts/partenaire__lead_", {
        headers: { Authorization: `Bearer ${HS_TOKEN}` },
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        const options = propData.options || [];
        const exists = options.some((o: { value: string }) => o.value === newUtm);

        if (!exists) {
          // Add new UTM value to enum
          options.push({ label: newNom, value: newUtm, displayOrder: -1, hidden: false });
          await fetch("https://api.hubapi.com/crm/v3/properties/contacts/partenaire__lead_", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ options }),
          });
        }
      }
    } catch (e) {
      // Don't fail the update if HubSpot sync fails
      console.error("HubSpot sync error on partner update:", e);
    }
  }

  return NextResponse.json(data);
}
