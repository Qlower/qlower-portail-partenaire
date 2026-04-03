import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

const PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "partenaire__lead_",
  "utm_source",
  "hs_lifecyclestage",
  "lifecyclestage",
  "hs_v2_date_entered_999998694",
];

// ── Map HubSpot lifecycle to our stage (same as sync-hubspot) ────
function mapStage(
  props: Record<string, string | null>
): "Abonne" | "Payeur" | "Non payeur" {
  const lc = (
    props.lifecyclestage ||
    props.hs_lifecyclestage ||
    ""
  ).toLowerCase();
  if (!lc) return "Non payeur";
  if (lc === "999998694") return "Abonne";
  if (["customer", "evangelist"].includes(lc)) return "Payeur";
  return "Non payeur";
}

// ── Sync HubSpot contacts for a specific partner UTM ────
async function syncContactsForPartner(
  supabase: ReturnType<typeof createServiceClient>,
  partnerId: string,
  partnerUtm: string
) {
  if (!HS_TOKEN) return { synced: 0, updated: 0, skipped: 0 };

  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            { propertyName: "partenaire__lead_", operator: "EQ", value: partnerUtm },
          ],
        },
      ],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  const summary = { synced: 0, updated: 0, skipped: 0 };

  for (const contact of contacts) {
    const props = contact.properties;
    const nom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
    const email = props.email || "";
    if (!email) { summary.skipped++; continue; }

    const stage = mapStage(props);
    const commissionDue = !!props.hs_v2_date_entered_999998694;

    const { data: existing } = await supabase
      .from("leads")
      .select("id, stage, commission_due")
      .eq("partner_id", partnerId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const newCommissionDue = existing.commission_due || commissionDue;
      await supabase
        .from("leads")
        .update({ stage, hs_contact_id: contact.id, commission_due: newCommissionDue })
        .eq("id", existing.id);
      if (!existing.commission_due && newCommissionDue) {
        await supabase.rpc("increment_partner_abonnes", { p_id: partnerId });
      }
      summary.updated++;
    } else {
      const now = new Date();
      await supabase.from("leads").insert({
        partner_id: partnerId,
        nom,
        email,
        source: "UTM",
        stage,
        mois: now.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
        biens: 0,
        hs_contact_id: contact.id,
        commission_due: commissionDue,
      });
      await supabase.rpc("increment_partner_leads", { p_id: partnerId });
      summary.synced++;
    }
  }

  return summary;
}

// POST batch create partners (admin only)
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { partners: partnersList } = await request.json();

  if (!Array.isArray(partnersList) || partnersList.length === 0) {
    return NextResponse.json({ error: "partners array is required" }, { status: 400 });
  }

  // Pre-fetch existing users for dedup
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const usersByEmail = new Map(
    (existingUsers?.users || []).map((u) => [u.email, u])
  );

  // Pre-fetch existing partners for dedup by UTM
  const { data: existingPartners } = await supabase
    .from("partners")
    .select("id, utm, code, email, nom");
  const partnersByUtm = new Map(
    (existingPartners || []).map((p) => [p.utm?.toLowerCase(), p])
  );
  const partnersByEmail = new Map(
    (existingPartners || []).filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p])
  );

  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const errors: Array<{ nom: string; error: string }> = [];

  for (const p of partnersList) {
    if (!p.nom) {
      errors.push({ nom: p.nom, error: "nom is required" });
      continue;
    }

    const slug = p.nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const utm = p.utm || slug;
    const code = p.code || null;

    // Check for existing partner by UTM or email
    const existingByUtm = partnersByUtm.get(utm.toLowerCase());
    const existingByEmail = p.email ? partnersByEmail.get(p.email.toLowerCase()) : null;
    const existingPartner = existingByUtm || existingByEmail;

    if (existingPartner) {
      // UPDATE existing partner: only update fields that are provided and non-empty
      const updates: Record<string, unknown> = {};
      if (code && !existingPartner.code) updates.code = code; // Set code promo if missing
      if (code && existingPartner.code !== code) updates.code = code; // Update code promo if different
      if (p.email && !existingPartner.email) updates.email = p.email;

      if (Object.keys(updates).length > 0) {
        await supabase.from("partners").update(updates).eq("id", existingPartner.id);
      }

      // Ensure auth user exists and has correct partner_id
      if (p.email) {
        const tempPassword = randomUUID().slice(0, 12);
        const existingUser = usersByEmail.get(p.email);
        if (existingUser) {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password: tempPassword,
            user_metadata: { ...existingUser.user_metadata, nom: p.nom, partner_id: existingPartner.id },
          });
        } else {
          await supabase.auth.admin.createUser({
            email: p.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { nom: p.nom, partner_id: existingPartner.id },
          });
        }
        updated.push({
          ...existingPartner,
          ...updates,
          tempPassword,
          _status: "updated",
        });
      } else {
        updated.push({ ...existingPartner, ...updates, tempPassword: "", _status: "updated" });
      }
      continue;
    }

    // CREATE new partner
    const tempPassword = randomUUID().slice(0, 12);
    const id = `${slug}-${Date.now().toString().slice(-4)}`;

    let userId = null;
    if (p.email) {
      const existing = usersByEmail.get(p.email);
      if (existing) {
        userId = existing.id;
        await supabase.auth.admin.updateUserById(existing.id, {
          password: tempPassword,
          user_metadata: { ...existing.user_metadata, nom: p.nom, partner_id: id },
        });
      } else {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: p.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { nom: p.nom, partner_id: id },
        });
        if (authError) {
          errors.push({ nom: p.nom, error: authError.message });
          continue;
        }
        userId = authUser.user.id;
      }
    }

    const { data, error } = await supabase
      .from("partners")
      .insert({
        id,
        user_id: userId,
        nom: p.nom,
        email: p.email || null,
        type: p.type || "autre",
        contrat: p.contrat || "affiliation",
        code,
        utm,
        comm_rules: [
          { type: "annuelle", montant: 100, actif: true },
          { type: "souscription", montant: 0, actif: false },
          { type: "biens", tranches: [{ max: 1, montant: 50 }, { max: 3, montant: 80 }, { max: 99, montant: 120 }], actif: false },
          { type: "pct_ca", pct: 0, actif: false },
        ],
      })
      .select()
      .single();

    if (error) {
      errors.push({ nom: p.nom, error: error.message });
    } else {
      created.push({ ...data, tempPassword });
      // Add to dedup maps for subsequent rows
      partnersByUtm.set(utm.toLowerCase(), data);
      if (p.email) partnersByEmail.set(p.email.toLowerCase(), data);
    }
  }

  // Sync new UTM values to HubSpot partenaire__lead_ enum
  if (HS_TOKEN && created.length > 0) {
    try {
      const hsHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };
      const propRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, { headers: hsHeaders });
      if (propRes.ok) {
        const propData = await propRes.json();
        const options = propData.options || [];
        const existingValues = new Set(options.map((o: { value: string }) => o.value));
        let changed = false;
        for (const partner of created) {
          if (partner.utm && !existingValues.has(partner.utm as string)) {
            options.push({ label: partner.nom, value: partner.utm, displayOrder: -1, hidden: false });
            changed = true;
          }
        }
        if (changed) {
          await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
            method: "PATCH",
            headers: hsHeaders,
            body: JSON.stringify({ options }),
          });
        }
      }
    } catch (e) {
      console.error("HubSpot enum sync error:", e);
    }
  }

  // AUTO-SYNC: Fetch HubSpot contacts for ALL created + updated partners
  const allPartners = [...created, ...updated];
  const syncResults: Record<string, { synced: number; updated: number; skipped: number }> = {};

  for (const partner of allPartners) {
    const pid = partner.id as string;
    const putm = partner.utm as string;
    if (pid && putm) {
      try {
        syncResults[pid] = await syncContactsForPartner(supabase, pid, putm);
      } catch (e) {
        console.error(`Sync error for ${putm}:`, e);
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    errors,
    syncResults,
  }, { status: 201 });
}
