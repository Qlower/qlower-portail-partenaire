import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET all partners (admin only - service_role bypasses RLS)
export async function GET() {
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

  // Sync UTM value to HubSpot partenaire__lead_ enum
  const HS_TOKEN = process.env.HUBSPOT_TOKEN;
  if (HS_TOKEN && utm) {
    try {
      const propRes = await fetch("https://api.hubapi.com/crm/v3/properties/contacts/partenaire__lead_", {
        headers: { Authorization: `Bearer ${HS_TOKEN}` },
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        const options = propData.options || [];
        if (!options.some((o: { value: string }) => o.value === utm)) {
          options.push({ label: nom, value: utm, displayOrder: -1, hidden: false });
          await fetch("https://api.hubapi.com/crm/v3/properties/contacts/partenaire__lead_", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ options }),
          });
        }
      }
    } catch (e) {
      console.error("HubSpot sync error on partner create:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH update partner (admin only)
export async function PATCH(request: NextRequest) {
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
