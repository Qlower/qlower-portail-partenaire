import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";

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

  const created = [];
  const errors = [];

  for (const p of partnersList) {
    if (!p.nom) {
      errors.push({ nom: p.nom, error: "nom is required" });
      continue;
    }

    // Generate secure temporary password
    const tempPassword = randomUUID().slice(0, 12);
    const slug = p.nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const id = `${slug}-${Date.now().toString().slice(-4)}`;
    const utm = p.utm || slug;
    const code = p.code || null; // Code promo set by admin later (must match Stripe)

    // Create or reuse auth user if email provided
    let userId = null;
    if (p.email) {
      const existing = usersByEmail.get(p.email);
      if (existing) {
        // Reuse existing user, update metadata and reset password
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
    }
  }

  // Sync new UTM values to HubSpot partenaire__lead_ enum (non-blocking)
  const HS_TOKEN = process.env.HUBSPOT_TOKEN;
  if (HS_TOKEN && created.length > 0) {
    try {
      const HS_BASE = "https://api.hubapi.com";
      const hsHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };
      const propRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, { headers: hsHeaders });
      if (propRes.ok) {
        const propData = await propRes.json();
        const options = propData.options || [];
        const existingValues = new Set(options.map((o: { value: string }) => o.value));
        let changed = false;
        for (const partner of created) {
          if (partner.utm && !existingValues.has(partner.utm)) {
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
      console.error("HubSpot sync error on batch create:", e);
    }
  }

  return NextResponse.json({ created, errors }, { status: 201 });
}
