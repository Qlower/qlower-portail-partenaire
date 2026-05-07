import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { notifyFlagChange } from "@/lib/sales-notifications";

// POST /api/sales/flag/[chargeId]
// body: { reason?: string, flag: boolean }
// A sales person flags an attribution as contested, asking the manager to
// arbitrate. Or unflags it. Sales_admin can also flag/unflag any row.
export async function POST(request: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
  const r = await verifySales(request);
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { flag?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const flag = !!body.flag;

  const sb = createServiceClient();

  // For sales: can only flag rows attributed to them
  if (auth.internal_role === "sales") {
    if (!auth.commercial_id) {
      return NextResponse.json({ error: "No commercial_id linked to your account" }, { status: 403 });
    }
    const { data: row } = await sb
      .from("attribution_rows")
      .select("auto_commercial_id, override_commercial_id")
      .eq("charge_id", chargeId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
    const effective = row.override_commercial_id || row.auto_commercial_id;
    // A sales contesting attribution: it can be a row that is currently NOT
    // attributed to them (they think it should be) or attributed to them but
    // they think it shouldn't be. We allow both — the manager will arbitrate.
    // Authorisation simply requires being internal sales.
    void effective;
  }

  const now = new Date().toISOString();
  const { error } = await sb
    .from("attribution_rows")
    .update({
      flagged_for_review: flag,
      flagged_by: flag ? auth.user_id : null,
      flagged_at: flag ? now : null,
      flagged_reason: flag ? (body.reason || null) : null,
    })
    .eq("charge_id", chargeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notification email — non-blocking (waitUntil-style swallow inside helper).
  await notifyFlagChange({
    chargeId,
    flagged: flag,
    byEmail: auth.email,
    byName: auth.name || auth.email,
    reason: body.reason || null,
  });

  return NextResponse.json({ ok: true, flagged: flag });
}
