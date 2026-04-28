import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/auth/setup-password?token=xxx
// Verifies token (read-only — does NOT consume it). Used by the page to validate
// before showing the form. The scanner email "pre-clicking" this URL doesn't break anything.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, reason: "missing_token" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("password_setup_tokens")
    .select("email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  if (row.used_at) return NextResponse.json({ valid: false, reason: "already_used" }, { status: 410 });
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 410 });
  }

  return NextResponse.json({ valid: true, email: row.email });
}

// POST /api/auth/setup-password
// Body: { token, password }
// Consumes the token, updates Supabase Auth user password.
export async function POST(request: NextRequest) {
  const { token, password } = await request.json();
  if (!token || !password) {
    return NextResponse.json({ error: "token and password required" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (8 caractères minimum)" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify token
  const { data: row } = await supabase
    .from("password_setup_tokens")
    .select("id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  if (row.used_at) return NextResponse.json({ error: "Lien déjà utilisé" }, { status: 410 });
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Lien expiré" }, { status: 410 });
  }

  // Find or create the user, then set password
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email?.toLowerCase() === row.email.toLowerCase());

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark token used
  await supabase
    .from("password_setup_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ ok: true, email: row.email });
}
