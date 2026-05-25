// GET /api/admin/email-templates/[id]/versions
//   → Liste les snapshots d'un template, plus récent en premier.
//   → Limite à 50 par défaut, override avec ?limit=N.
//
// POST /api/admin/email-templates/[id]/versions
//   → Étoile une version existante : body { version_id, label }.
//   → Permet de renommer / étoiler a posteriori une version auto-save.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_template_versions")
    .select("id, label, saved_at, saved_by_email, subject, body")
    .eq("template_id", id)
    .order("saved_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { id: templateId } = await ctx.params;
  const body = await request.json();
  const { version_id, label } = body as { version_id: string; label: string | null };

  if (!version_id) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_template_versions")
    .update({ label: label && label.trim() ? label.trim() : null })
    .eq("id", version_id)
    .eq("template_id", templateId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
