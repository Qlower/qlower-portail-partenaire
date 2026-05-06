import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AddBody {
  name: string;
  email: string;
  hubspot_owner_id: string;
  role?: "sales" | "upsell" | "support" | "sales_admin";
  share_fraction?: number;
}

function generatePassword(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const d = "23456789";
  const s = "!@#$%&*";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join("");
  const arr = (pick(a, 8) + pick(d, 4) + pick(s, 4)).split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

// POST /api/sales/commercials
//   body: { name, email, hubspot_owner_id, role?, share_fraction? }
// Creates a new Supabase Auth user + commercials row + monthly targets
// for the current year. Returns the initial password (one-shot, never stored).
export async function POST(request: NextRequest) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;

  let body: AddBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !body.email?.trim() || !body.hubspot_owner_id?.trim()) {
    return NextResponse.json(
      { error: "name, email and hubspot_owner_id are required" },
      { status: 400 },
    );
  }
  const role = body.role || "sales";
  const share = body.share_fraction ?? 0;

  const sb = createServiceClient();

  // Check no existing commercial with this owner_id or email
  const { data: existing } = await sb
    .from("commercials")
    .select("id")
    .or(`hubspot_owner_id.eq.${body.hubspot_owner_id},email.eq.${body.email}`)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "A commercial with this hubspot_owner_id or email already exists" },
      { status: 409 },
    );
  }

  // Create Supabase Auth user
  const password = generatePassword();
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      password,
      email_confirm: true,
      user_metadata: {
        internal_role: role === "support" ? null : role === "sales_admin" ? "sales_admin" : "sales",
        hubspot_owner_id: body.hubspot_owner_id,
        name: body.name,
      },
    }),
  });
  if (!userRes.ok) {
    const t = await userRes.text();
    return NextResponse.json(
      { error: `Auth user creation failed: ${t.slice(0, 200)}` },
      { status: 500 },
    );
  }
  const userData = await userRes.json();
  const userId = userData.id as string;

  // Create commercial row
  const { data: commercial, error: cErr } = await sb
    .from("commercials")
    .insert({
      user_id: userId,
      hubspot_owner_id: body.hubspot_owner_id,
      name: body.name,
      email: body.email,
      role,
      active: true,
      share_fraction: share,
    })
    .select("id")
    .single();
  if (cErr || !commercial) {
    return NextResponse.json(
      { error: `commercials insert failed: ${cErr?.message}` },
      { status: 500 },
    );
  }

  // Update Auth user with commercial_id
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_metadata: {
        internal_role: role === "support" ? null : role === "sales_admin" ? "sales_admin" : "sales",
        hubspot_owner_id: body.hubspot_owner_id,
        name: body.name,
        commercial_id: commercial.id,
      },
    }),
  });

  // Generate per-month targets for current year if share_fraction > 0
  if (share > 0) {
    const year = new Date().getFullYear();
    const { data: teamTargets } = await sb
      .from("team_monthly_targets")
      .select("year_month, target_eur")
      .like("year_month", `${year}-%`);
    if (teamTargets && teamTargets.length > 0) {
      const inserts = teamTargets.map((t) => ({
        commercial_id: commercial.id,
        year_month: t.year_month,
        target_eur: Math.round(t.target_eur * share),
      }));
      await sb.from("commercial_monthly_targets").insert(inserts);
    }
  }

  return NextResponse.json({
    ok: true,
    commercial_id: commercial.id,
    user_id: userId,
    initial_password: password,
    info: "Communiquer ce mot de passe au commercial en privé. Il devra le changer au premier login.",
  });
}

// PATCH /api/sales/commercials  body: { id, active? }
// Toggle active state (deactivate without deleting → preserves history)
export async function PATCH(request: NextRequest) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;

  let body: { id?: string; active?: boolean; share_fraction?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.share_fraction === "number") updates.share_fraction = body.share_fraction;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { error } = await sb.from("commercials").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: body.id, ...updates });
}
