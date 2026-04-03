import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/admin/leads?partner_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");

  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
