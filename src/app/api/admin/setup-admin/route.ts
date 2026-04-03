import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// ONE-TIME endpoint to create admin user — DELETE THIS FILE AFTER USE
export async function POST(request: NextRequest) {
  const { email, password, secret } = await request.json();

  // Simple secret to prevent random calls before auth is set up
  if (secret !== "qlower-setup-2026") {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if user already exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email === email);

  if (existing) {
    // Update existing user: set role to admin and update password
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { ...existing.user_metadata, role: "admin" },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "updated", userId: existing.id });
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "created", userId: data.user.id });
}
