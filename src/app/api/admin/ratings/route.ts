// API admin pour gérer les avis NTS (Note Trèfle) des partenaires.
//
// GET    /api/admin/ratings           → liste tous les avis (filters optionnels)
// PATCH  /api/admin/ratings           → curation : marque un avis comme sélectionné
//                                       pour usage externe (site / MB / invest)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

async function verifyAdminOrSalesAdmin(request: NextRequest): Promise<
  { ok: true; email: string } | { ok: false; error: NextResponse }
> {
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
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  // Admin email strict OK
  const adminCheck = await verifyAdmin(request);
  if (!adminCheck.error) return { ok: true, email: user.email || "admin" };

  // sales_admin fallback
  const internalRole = (user.user_metadata as Record<string, unknown> | undefined)?.internal_role;
  if (internalRole === "sales_admin") return { ok: true, email: user.email || "manager" };

  return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

export async function GET(request: NextRequest) {
  const a = await verifyAdminOrSalesAdmin(request);
  if (!a.ok) return a.error;

  const url = new URL(request.url);
  const filterCurated = url.searchParams.get("curated");
  const minRating = parseInt(url.searchParams.get("min_rating") || "0", 10);

  const sb = createServiceClient();
  let q = sb
    .from("partner_ratings")
    .select("id, partner_id, author_email, rating, scope, comment, created_at, curated, curated_quote, curator_note, curated_by, curated_at, used_in")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filterCurated === "true") q = q.eq("curated", true);
  if (filterCurated === "false") q = q.eq("curated", false);
  if (minRating > 0) q = q.gte("rating", minRating);

  const { data: ratings, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hydrater avec nom partenaire
  const partnerIds = [...new Set((ratings || []).map((r) => r.partner_id))];
  const { data: partners } = partnerIds.length
    ? await sb.from("partners").select("id, nom, contrat, utm").in("id", partnerIds)
    : { data: [] as Array<{ id: string; nom: string; contrat: string; utm: string }> };
  const partnerById = new Map((partners || []).map((p) => [p.id, p]));

  const hydrated = (ratings || []).map((r) => ({
    ...r,
    partner: partnerById.get(r.partner_id) || null,
  }));

  return NextResponse.json({ ok: true, ratings: hydrated });
}

export async function PATCH(request: NextRequest) {
  const a = await verifyAdminOrSalesAdmin(request);
  if (!a.ok) return a.error;

  let body: {
    id?: string;
    curated?: boolean;
    curated_quote?: string;
    curator_note?: string;
    used_in?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.curated === "boolean") {
    updates.curated = body.curated;
    if (body.curated) {
      updates.curated_at = new Date().toISOString();
      updates.curated_by = a.email;
    } else {
      updates.curated_at = null;
      updates.curated_by = null;
    }
  }
  if (body.curated_quote !== undefined) updates.curated_quote = body.curated_quote || null;
  if (body.curator_note !== undefined) updates.curator_note = body.curator_note || null;
  if (Array.isArray(body.used_in)) updates.used_in = body.used_in;

  const sb = createServiceClient();
  const { error } = await sb.from("partner_ratings").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: body.id });
}
