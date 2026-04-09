import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";

// POST — self-service partner registration (no admin required)
// Only creates the partner record; auth user is already created client-side via signUp
export async function POST(request: NextRequest) {
  // Verify the user is authenticated via Authorization header (preferred) or cookies
  const authHeader = request.headers.get("authorization");
  let user = null;

  if (authHeader?.startsWith("Bearer ")) {
    // Use the token from Authorization header (set right after signUp)
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseWithToken = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supabaseWithToken.auth.getUser();
    if (!error && data.user) user = data.user;
  }

  if (!user) {
    // Fallback to cookies
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      },
    );
    const { data, error } = await supabaseAuth.auth.getUser();
    if (!error && data.user) user = data.user;
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const body = await request.json();

  const {
    id, nom, contact_prenom, contact_nom, email, utm,
    metier, siret, tva, adresse, ville, code_postal, telephone, iban, bic,
    comm_rules,
  } = body;

  if (!id || !nom || !utm) {
    return NextResponse.json({ error: "id, nom, and utm are required" }, { status: 400 });
  }

  // Ensure the user_id matches the authenticated user (prevent spoofing)
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
