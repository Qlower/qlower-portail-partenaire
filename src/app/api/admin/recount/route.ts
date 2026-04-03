import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// POST /api/admin/recount — Recount leads and abonnes for all partners
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createServiceClient();

  const { data: partners } = await supabase.from("partners").select("id");
  if (!partners) return NextResponse.json({ error: "No partners" }, { status: 500 });

  const results: Array<{ id: string; leads: number; abonnes: number }> = [];

  for (const p of partners) {
    const { count: leadCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", p.id);

    const { count: abonnesCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", p.id)
      .eq("stage", "Abonne");

    await supabase
      .from("partners")
      .update({ leads: leadCount || 0, abonnes: abonnesCount || 0 })
      .eq("id", p.id);

    results.push({ id: p.id, leads: leadCount || 0, abonnes: abonnesCount || 0 });
  }

  return NextResponse.json({ recounted: results.length, results });
}
