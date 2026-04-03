import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// ONE-TIME setup route — DELETE THIS FILE after use
// Call: POST /api/setup/admin-role with { "email": "admin@qlower.com", "secret": "qlower-setup-2026" }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, secret } = body;

  if (secret !== "qlower-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = users?.users?.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: `User ${email} not found` }, { status: 404 });
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: "admin" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user_id: data.user.id,
    email: data.user.email,
    metadata: data.user.user_metadata,
  });
}
