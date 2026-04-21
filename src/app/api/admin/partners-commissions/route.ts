import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/admin/partners-commissions
// Returns aggregated commission data per partner computed with the SAME logic
// as /api/partner/commissions (HubSpot live + rules applied per year),
// so admin and partner dashboards always show the same numbers.
//
// Response: [{ partnerId, totalSubscribers, totalCommission }]
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("id")
    .eq("active", true);

  if (!partners) return NextResponse.json([]);

  const origin = new URL(request.url).origin;
  const cookieHeader = request.headers.get("cookie") || "";

  // Parallelize calls to the existing commission endpoint
  const results = await Promise.all(
    partners.map(async (p) => {
      try {
        const res = await fetch(
          `${origin}/api/partner/commissions?partner_id=${p.id}&year=all`,
          { headers: { cookie: cookieHeader } }
        );
        if (!res.ok) return { partnerId: p.id, totalSubscribers: 0, totalCommission: 0 };
        const data = await res.json();
        return {
          partnerId: p.id,
          totalSubscribers: data.totalSubscribers ?? 0,
          totalCommission: data.totalCommission ?? 0,
        };
      } catch {
        return { partnerId: p.id, totalSubscribers: 0, totalCommission: 0 };
      }
    })
  );

  return NextResponse.json(results);
}
