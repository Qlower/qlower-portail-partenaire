import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/partner/active-years?partner_id=X
// Returns years eligible for invoicing : activity in the year AND contract was signed at that time.
// If contract_signed_at is NULL : fallback to current-year-1 only (so admin can still trigger
// a first call while filling the contract date later).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const [{ data: partner }, { data: leads }] = await Promise.all([
    supabase.from("partners").select("contract_signed_at").eq("id", partnerId).single(),
    supabase.from("leads").select("first_paid_at, subscribed_at, unsubscribed_at").eq("partner_id", partnerId),
  ]);

  const contractYear = partner?.contract_signed_at
    ? new Date(partner.contract_signed_at).getFullYear()
    : null;

  const activity = new Set<number>();
  for (const l of leads || []) {
    for (const d of [l.first_paid_at, l.subscribed_at, l.unsubscribed_at]) {
      if (d) {
        const y = new Date(d).getFullYear();
        if (!isNaN(y)) activity.add(y);
      }
    }
  }

  // Keep only years >= contract signing year (if known)
  const eligible = Array.from(activity).filter((y) =>
    contractYear === null ? true : y >= contractYear
  );

  const sorted = eligible.sort((a, b) => b - a);
  return NextResponse.json({
    years: sorted,
    contract_signed_at: partner?.contract_signed_at ?? null,
    contract_year: contractYear,
    has_any_activity: activity.size > 0,
  });
}
