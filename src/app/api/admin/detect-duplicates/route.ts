import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { detectDuplicates } from "@/lib/detect-duplicates";

export const maxDuration = 60;

/**
 * Auth helper qui accepte SOIT un admin email (alex/admin@qlower.com) SOIT un
 * sales_admin (alex+manager@qlower.com). Permet à la nav TDC d'utiliser cette
 * page sans dupliquer la route sous /api/sales/.
 */
async function verifyAdminOrSalesAdmin(request: NextRequest): Promise<{ error?: NextResponse }> {
  // Premier essai : admin email standard
  const adminCheck = await verifyAdmin(request);
  if (!adminCheck.error) return {};

  // Fallback : check user_metadata.internal_role === "sales_admin"
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const internalRole = (user?.user_metadata as Record<string, unknown> | undefined)?.internal_role;
  if (internalRole === "sales_admin") return {};

  return adminCheck;
}

// POST /api/admin/detect-duplicates
// body (optionnel): { maxContacts?: number, windowDays?: number }
// Déclenche un scan HubSpot et upsert les groupes de doublons probables.
export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrSalesAdmin(request);
  if (auth.error) return auth.error;

  let body: { maxContacts?: number; windowDays?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Body optionnel
  }

  try {
    const report = await detectDuplicates({
      maxContacts: body.maxContacts,
      windowDays: body.windowDays,
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur inconnue" },
      { status: 500 },
    );
  }
}

// GET /api/admin/detect-duplicates?resolved=false
// Renvoie la liste des groupes de doublons détectés.
export async function GET(request: NextRequest) {
  const auth = await verifyAdminOrSalesAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const resolvedParam = url.searchParams.get("resolved");
  const sb = createServiceClient();

  let q = sb
    .from("hubspot_duplicates")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(200);
  if (resolvedParam === "false") q = q.eq("resolved", false);
  if (resolvedParam === "true") q = q.eq("resolved", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, groups: data || [] });
}

// PATCH /api/admin/detect-duplicates  body: { id, resolved, note? }
// Marque un groupe comme résolu (= "j'ai mergé" ou "faux positif").
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminOrSalesAdmin(request);
  if (auth.error) return auth.error;

  let body: { id?: string; resolved?: boolean; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = createServiceClient();
  const updates: Record<string, unknown> = {};
  if (typeof body.resolved === "boolean") {
    updates.resolved = body.resolved;
    updates.resolved_at = body.resolved ? new Date().toISOString() : null;
    updates.resolved_by = body.resolved ? "admin" : null;
  }
  if (body.note !== undefined) updates.resolution_note = body.note;

  const { error } = await sb.from("hubspot_duplicates").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: body.id });
}
