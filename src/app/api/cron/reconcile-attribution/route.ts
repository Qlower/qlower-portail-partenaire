import { NextRequest, NextResponse } from "next/server";
import { reconcileAttribution } from "@/services/reconcile";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const maxDuration = 60;

// Vercel Cron — runs reconcile in apply=true mode.
// Acts as a fallback when the HubSpot webhook misses the
// `hs_analytics_source_data_2` property change event.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only scan the last 7 days — covers any webhook miss without re-scanning
  // the whole 90-day window (the admin button still defaults to 90 days).
  const result = await reconcileAttribution(true, 7);
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }

  console.log(
    `[cron:reconcile] scanned=${result.scannedOrphans} matched=${result.matchedCount} ` +
      `tagged=${result.matched.filter((m) => m.patched).length} ambiguous=${result.ambiguousCount}`
  );
  return NextResponse.json({
    scanned: result.scannedOrphans,
    matched: result.matchedCount,
    tagged: result.matched.filter((m) => m.patched).length,
    ambiguous: result.ambiguousCount,
  });
}
