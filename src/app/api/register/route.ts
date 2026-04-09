import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// POST — self-service partner registration (no admin required)
// Verifies the user_id exists in auth before creating the partner record
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();

  const {
    id, user_id, nom, contact_prenom, contact_nom, email, utm,
    metier, siret, tva, adresse, ville, code_postal, telephone, iban, bic,
    comm_rules,
  } = body;

  if (!id || !nom || !utm || !user_id) {
    return NextResponse.json({ error: "id, nom, utm, and user_id are required" }, { status: 400 });
  }

  // Verify user_id exists in Supabase Auth (prevent spoofing)
  const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(user_id);
  if (authError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { data, error } = await supabase.from("partners").insert({
    id,
    user_id: user.id,
    nom,
    contact_prenom: contact_prenom || null,
    contact_nom: contact_nom || null,
    email: email || user.email,
    type: "autre",
    contrat: "affiliation",
    code: null,
    utm,
    comm_rules: comm_rules || [],
    comm_obj_annuel: 500,
    statut: "en_attente",
    metier: metier || null,
    siret: siret || null,
    tva: tva || null,
    adresse: adresse || null,
    ville: ville || null,
    code_postal: code_postal || null,
    telephone: telephone || null,
    iban: iban || null,
    bic: bic || null,
  }).select().single();

  if (error) {
    console.error("[register] Insert error:", error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync to Google Sheets
  const GSHEET_WEBHOOK = process.env.GSHEET_WEBHOOK_URL;
  if (GSHEET_WEBHOOK) {
    try {
      const params = new URLSearchParams({
        nom: contact_nom || nom,
        prenom: contact_prenom || "",
        email: email || user.email || "",
        entreprise: nom,
        code_promo: "",
        utm,
        contrat: "affiliation",
        mot_de_passe: "(inscription autonome)",
      });
      await fetch(`${GSHEET_WEBHOOK}?${params.toString()}`);
    } catch (e) {
      console.error("[register] Google Sheets sync error:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
