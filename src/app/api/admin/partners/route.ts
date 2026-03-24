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

  const { data, error } = await supabase
    .from("partners")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
