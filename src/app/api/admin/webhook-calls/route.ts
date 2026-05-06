import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/admin/webhook-calls
//
// Returns the latest incoming HubSpot webhook calls (proof of receipt).
// Use to verify whether HubSpot is actually triggering our webhook for new
// contacts. If this list is empty after creating a new contact in HubSpot,
// the issue is the HubSpot Private App webhook subscription config (not us).
//
// Query params:
//   ?limit=50              (default 50, max 200)
//   ?since=2026-05-06      (ISO date, optional)
//   ?contact=12345         (filter to one contact id, optional)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const since = url.searchParams.get("since");
  const contactId = url.searchParams.get("contact");

  const sb = createServiceClient();
  let q = sb
    .from("webhook_call_log")
    .select(
      "id, received_at, source_ip, user_agent, has_token, events_count, contact_ids, body_size, body_excerpt, http_status, result_summary",
    )
    .order("received_at", { ascending: false })
    .limit(limit);

  if (since) q = q.gte("received_at", since);
  if (contactId) q = q.contains("contact_ids", [contactId]);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stats summary on the returned set
  const total = data?.length || 0;
  const byStatus: Record<string, number> = {};
  const sources = new Set<string>();
  const userAgents = new Set<string>();
  for (const row of data || []) {
    const k = String(row.http_status || "no_response");
    byStatus[k] = (byStatus[k] || 0) + 1;
    if (row.source_ip) sources.add(row.source_ip);
    if (row.user_agent) userAgents.add(row.user_agent.split(" ")[0] || "");
  }

  return NextResponse.json({
    total,
    byStatus,
    distinctSources: sources.size,
    distinctUserAgents: [...userAgents],
    latestReceivedAt: data?.[0]?.received_at || null,
    rows: data,
  });
}
