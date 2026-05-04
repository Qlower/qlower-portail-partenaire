import { NextRequest, NextResponse } from "next/server";
import { reconcileAttribution } from "@/services/reconcile";
import { syncHubspotEnum } from "@/services/sync-enum";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const maxDuration = 60;

// Vercel Cron — runs reconcile in apply=true mode every 15 minutes.
// Acts as a fallback when the HubSpot webhook misses the
// `hs_analytics_source_data_2` property change event.
// See vercel.json for the cron schedule definition.
//
// Two-step process per tick:
//   1. Sync the HubSpot `partenaire__lead_` enum with active partners
//      (so any newly-created partner whose onboard-partner call failed
//      gets its enum option auto-added — otherwise tagging fails silently)
//   2. Reconcile attribution: tag orphan contacts whose UTM matches a
//      known active partner.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 1: ensure enum is up-to-date so step 2 can actually tag
  let syncReport;
  try {
    syncReport = await syncHubspotEnum(true);
    if (syncReport.added > 0) {
      console.log(
        `[cron:sync-enum] added=${syncReport.added} items=${syncReport.addedItems
          .map((i) => i.utm)
          .join(",")}`
      );
    }
  } catch (e) {
    console.log(`[cron:sync-enum] error: ${e instanceof Error ? e.message : e}`);
    syncReport = null;
  }

  // Step 2: reconcile attribution (last 7 days)
  const result = await reconcileAttribution(true, 7);
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }

  console.log(
    `[cron:reconcile] scanned=${result.scannedOrphans} matched=${result.matchedCount} ` +
      `tagged=${result.matched.filter((m) => m.patched).length} ambiguous=${result.ambiguousCount}`
  );

  return NextResponse.json({
    enumSync: syncReport
      ? { added: syncReport.added, missingBefore: syncReport.missingActiveCount }
      : { error: true },
    reconcile: {
      scanned: result.scannedOrphans,
      matched: result.matchedCount,
      tagged: result.matched.filter((m) => m.patched).length,
      ambiguous: result.ambiguousCount,
    },
  });
}
