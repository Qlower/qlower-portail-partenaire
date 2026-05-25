// POST /api/admin/email-templates/[id]/restore
// Body : { version_id }
//
// Restaure un template à un état précédent :
//   1. Lit la version cible
//   2. Archive l'état actuel comme version "Auto-save avant restauration de '<label>'"
//   3. Update le template avec le contenu de la version cible
//
// Rien n'est jamais perdu — l'état actuel est sauvegardé avant le rollback.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { id: templateId } = await ctx.params;
  const body = await request.json();
  const { version_id } = body as { version_id: string };
  if (!version_id) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1) Récupère la version cible
  const { data: version, error: vErr } = await supabase
    .from("email_template_versions")
    .select("id, subject, body, label, saved_at")
    .eq("id", version_id)
    .eq("template_id", templateId)
    .single();
  if (vErr || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // 2) Récupère l'état actuel + l'archive
  const { data: current, error: cErr } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", templateId)
    .single();
  if (cErr || !current) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Email admin pour la trace
  let savedByEmail: string | null = null;
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );
    const { data: { user } } = await sb.auth.getUser();
    savedByEmail = user?.email || null;
  } catch {}

  const versionLabel = version.label || new Date(version.saved_at).toLocaleString("fr-FR");
  const archiveLabel = `Auto-save avant restauration de "${versionLabel}"`;

  await supabase.from("email_template_versions").insert({
    template_id: templateId,
    subject: current.subject,
    body: current.body,
    label: archiveLabel,
    saved_by_email: savedByEmail,
  });

  // 3) Restaure le template
  const { data, error: uErr } = await supabase
    .from("email_templates")
    .update({
      subject: version.subject,
      body: version.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select()
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data, restored_from: version.id });
}
