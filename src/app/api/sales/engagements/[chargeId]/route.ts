import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { loadEngagementHistory } from "@/lib/hubspot-engagements";

export const maxDuration = 30;

// GET /api/sales/engagements/[chargeId]
//
// Renvoie la chronologie HubSpot complète (Modjo / RDV / Aircall / notes / SMS)
// pour le client lié à cette charge. Match par email + téléphone (gère les
// fiches HubSpot dupliquées). Lecture seule, accessible à tout sales authentifié.
export async function GET(request: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
  const r = await verifySales(request);
  if ("error" in r) return r.error;

  const { chargeId } = await ctx.params;
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  const sb = createServiceClient();
  const { data: row } = await sb
    .from("attribution_rows")
    .select("charge_id, email, phone, client_name, amount_net_eur, created_at")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  try {
    const history = await loadEngagementHistory({ email: row.email, phone: row.phone });
    return NextResponse.json({
      ok: true,
      charge: {
        charge_id: row.charge_id,
        email: row.email,
        phone: row.phone,
        client_name: row.client_name,
        amount_net_eur: row.amount_net_eur,
        created_at: row.created_at,
      },
      ...history,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `HubSpot fetch failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    );
  }
}
