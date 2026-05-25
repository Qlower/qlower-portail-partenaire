import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET all email templates
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH update a template
// Body : { id, subject?, body?, versionLabel? }
//
// Avant l'UPDATE on archive l'état COURANT dans email_template_versions →
// historique automatique sans effort côté UI. Si versionLabel est fourni,
// la version archivée prend ce nom (ex: "Avant refonte du wording"), sinon
// label reste NULL (= auto-save).
//
// Si seul versionLabel est fourni (sans subject ni body change), on crée
// juste un snapshot nommé du state actuel sans modifier le template.
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await request.json();
  const { id, subject, body: templateBody, versionLabel } = body as {
    id: string;
    subject?: string;
    body?: string;
    versionLabel?: string | null;
  };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // 1) Snapshot du state COURANT avant tout update (pour pouvoir revenir).
  const { data: current, error: readErr } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", id)
    .single();
  if (readErr || !current) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Récupère l'email admin (pour saved_by_email)
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
  } catch {
    // pas bloquant
  }

  const hasContentChange =
    (subject !== undefined && subject !== current.subject) ||
    (templateBody !== undefined && templateBody !== current.body);
  const hasLabel = !!(versionLabel && versionLabel.trim());

  // On n'archive que si quelque chose va vraiment changer OU si on étoile.
  if (hasContentChange || hasLabel) {
    await supabase.from("email_template_versions").insert({
      template_id: id,
      subject: current.subject,
      body: current.body,
      label: hasLabel ? versionLabel!.trim() : null,
      saved_by_email: savedByEmail,
    });
  }

  // Si pas de contenu nouveau (juste un étoilage), on renvoie l'état tel quel
  if (!hasContentChange) {
    return NextResponse.json({ ...current, id, snapshot_created: hasLabel });
  }

  // Update le template
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (subject !== undefined) updates.subject = subject;
  if (templateBody !== undefined) updates.body = templateBody;

  const { data, error } = await supabase
    .from("email_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
