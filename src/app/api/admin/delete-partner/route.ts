import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// POST /api/admin/delete-partner  { id: "xxx", move_to?: "yyy" }
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { id, move_to: moveTo } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let leadsMoved = 0;

  if (moveTo) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, email")
      .eq("partner_id", id);

    for (const lead of leads || []) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("partner_id", moveTo)
        .eq("email", lead.email)
        .maybeSingle();

      if (existing) {
        await supabase.from("leads").delete().eq("id", lead.id);
      } else {
        await supabase.from("leads").update({ partner_id: moveTo }).eq("id", lead.id);
        leadsMoved++;
      }
    }

    await supabase.from("partner_actions").update({ partner_id: moveTo }).eq("partner_id", id);

    // Recount
    const { count: leadCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", moveTo);
    const { count: abonnesCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", moveTo)
      .eq("stage", "Abonne");
    await supabase.from("partners").update({ leads: leadCount || 0, abonnes: abonnesCount || 0 }).eq("id", moveTo);
  } else {
    await supabase.from("leads").delete().eq("partner_id", id);
    await supabase.from("partner_actions").delete().eq("partner_id", id);
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id, leadsMoved });
}
