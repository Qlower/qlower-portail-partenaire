import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { syncHubspotEnum } from "@/services/sync-enum";

export const maxDuration = 30;

// Kept as an admin debug endpoint. The cron at /api/cron/reconcile-attribution
// also calls syncHubspotEnum() on every tick, so this should rarely be needed.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  try {
    const report = await syncHubspotEnum(false);
    return NextResponse.json({ mode: "dry-run", ...report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  try {
    const report = await syncHubspotEnum(true);
    return NextResponse.json({ mode: "applied", ...report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
