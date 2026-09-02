import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/campaign-history
// Returns the list of past campaigns (most recent first), each with the recipients' names.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();

  const { data: sends, error } = await supabase
    .from("campaign_sends")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Collect all unique partner_ids referenced across all sends to fetch names in one query
  const allIds = Array.from(
    new Set((sends ?? []).flatMap((s) => (s.partner_ids ?? []) as string[]))
  );

  let nameById: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, nom")
      .in("id", allIds);
    nameById = Object.fromEntries((partners ?? []).map((p) => [p.id, p.nom]));
  }

  // Compteurs d'ouverture / délivrance par campagne (via campaign_email_events,
  // alimenté par le webhook Resend). Défensif : si la table n'existe pas encore
  // (migration à faire), on renvoie simplement des compteurs nuls.
  const opensByCampaign: Record<string, { tracked: number; opened: number; delivered: number }> = {};
  try {
    const sendIds = (sends ?? []).map((s) => s.id);
    if (sendIds.length > 0) {
      const { data: events } = await supabase
        .from("campaign_email_events")
        .select("campaign_send_id, opened_at, delivered_at")
        .in("campaign_send_id", sendIds);
      for (const e of events ?? []) {
        const k = e.campaign_send_id as string;
        opensByCampaign[k] = opensByCampaign[k] || { tracked: 0, opened: 0, delivered: 0 };
        opensByCampaign[k].tracked++;
        if (e.opened_at) opensByCampaign[k].opened++;
        if (e.delivered_at) opensByCampaign[k].delivered++;
      }
    }
  } catch {
    // table absente → pas de tracking d'ouverture pour l'instant
  }

  const enriched = (sends ?? []).map((s) => ({
    ...s,
    recipients: ((s.partner_ids ?? []) as string[]).map((id) => ({
      id,
      nom: nameById[id] ?? id,
    })),
    opens: opensByCampaign[s.id] ?? { tracked: 0, opened: 0, delivered: 0 },
  }));

  return NextResponse.json(enriched);
}
