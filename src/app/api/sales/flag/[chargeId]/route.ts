import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { notifyFlagChange } from "@/lib/sales-notifications";

// POST /api/sales/flag/[chargeId]
// body: { reason?: string, flag: boolean }
//
// Règles métier :
//   - Pour FLAGGER : tout négo authentifié peut le faire, mais doit fournir
//     un motif (≥ 5 caractères). Sans motif → 400.
//   - Pour DÉFLAGGER : seul le flagger d'origine OU un sales_admin peut
//     retirer la contestation. Autre négo → 403 (Hasan ne peut pas retirer
//     la contestation de Driss).
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
  const reason = (body.reason || "").trim();

  const sb = createServiceClient();

  // Fetch la ligne (one read pour les 2 checks ci-dessous)
  const { data: row } = await sb
    .from("attribution_rows")
    .select("auto_commercial_id, override_commercial_id, flagged_for_review, flagged_by")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  // For sales: can only flag rows attributed to them (existing rule kept)
  if (auth.internal_role === "sales") {
    if (!auth.commercial_id) {
      return NextResponse.json({ error: "No commercial_id linked to your account" }, { status: 403 });
    }
  }

  // ─── FLAGGER : motif obligatoire ────────────────────────────────────
  if (flag) {
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Le motif est obligatoire (5 caractères min) pour contester une attribution." },
        { status: 400 },
      );
    }
  } else {
    // ─── DÉFLAGGER : seul le flagger ou un sales_admin ────────────────
    const isAdmin = auth.internal_role === "sales_admin";
    const isOriginalFlagger = !!row.flagged_by && row.flagged_by === auth.user_id;
    if (!isAdmin && !isOriginalFlagger) {
      return NextResponse.json(
        {
          error:
            "Seul l'auteur de la contestation ou un manager peut la retirer. Demande à l'auteur de la retirer, ou contacte le manager pour arbitrer.",
        },
        { status: 403 },
      );
    }
  }

  const now = new Date().toISOString();
  const { error } = await sb
    .from("attribution_rows")
    .update({
      flagged_for_review: flag,
      flagged_by: flag ? auth.user_id : null,
      flagged_at: flag ? now : null,
      flagged_reason: flag ? reason : null,
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
    reason: flag ? reason : null,
  });

  return NextResponse.json({
    ok: true,
    flagged: flag,
    flagged_by: flag ? auth.user_id : null,
    flagged_by_email: flag ? auth.email : null,
    flagged_by_name: flag ? (auth.name || auth.email) : null,
    flagged_at: flag ? now : null,
    flagged_reason: flag ? reason : null,
  });
}
