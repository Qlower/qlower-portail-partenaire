import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

interface OverrideBody {
  commercial_id?: string | null;     // commercials.id; null/empty = clear override
  comment?: string | null;
}

// POST /api/sales/overrides/[chargeId]
// body: { commercial_id: <uuid>, comment?: string }
// Sets the override for this charge to the given commercial_id, logs in
// attribution_history. Pass commercial_id=null to clear.
export async function POST(request: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: OverrideBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Fetch current state of the row + commercial names for the audit log
  const { data: row, error: rowErr } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, auto_commercial_id, override_commercial_id")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  // Check the run isn't locked
  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", row.run_id)
    .maybeSingle();
  if (run?.locked) {
    return NextResponse.json({ error: `Le mois ${run.year_month} est verrouillé` }, { status: 423 });
  }

  // Resolve commercial names for the history log
  const fromId = row.override_commercial_id || row.auto_commercial_id;
  const toId = body.commercial_id || null;
  const involvedIds = [fromId, toId].filter(Boolean) as string[];
  const { data: cs } = await sb
    .from("commercials")
    .select("id, name")
    .in("id", involvedIds.length > 0 ? involvedIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map((cs || []).map((c) => [c.id, c.name as string]));
  const fromName = fromId ? nameById.get(fromId) || "—" : "Non attribué";
  const toName = toId ? nameById.get(toId) || "—" : "(reset auto)";

  // Apply
  const now = new Date().toISOString();
  const { error: updErr } = await sb
    .from("attribution_rows")
    .update({
      override_commercial_id: toId,
      override_set_by: toId ? auth.user_id : null,
      override_set_at: toId ? now : null,
      // If the manager is overriding, the contestation is implicitly resolved.
      flagged_for_review: false,
      flagged_by: null,
      flagged_at: null,
    })
    .eq("charge_id", chargeId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Append audit history (append-only, no update/delete)
  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: fromName,
    to_commercial: toName,
    comment: body.comment || null,
  });

  return NextResponse.json({
    ok: true,
    charge_id: chargeId,
    override_commercial_id: toId,
    history_entry: { from: fromName, to: toName, who: auth.email, when: now },
  });
}

// DELETE /api/sales/overrides/[chargeId]
// Equivalent to POST with commercial_id: null
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
  // Reuse POST logic by reconstructing the request with a clear payload
  const newReq = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ commercial_id: null }),
  });
  return POST(newReq, ctx);
}
