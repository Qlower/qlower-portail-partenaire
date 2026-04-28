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

  const enriched = (sends ?? []).map((s) => ({
    ...s,
    recipients: ((s.partner_ids ?? []) as string[]).map((id) => ({
      id,
      nom: nameById[id] ?? id,
    })),
  }));

  return NextResponse.json(enriched);
}
