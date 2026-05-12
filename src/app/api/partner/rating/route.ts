// API partenaire pour la notation interne (NTS).
//
// POST   /api/partner/rating   body: { rating, scope?, comment? }
//        → Crée un nouvel avis pour le partenaire connecté
// GET    /api/partner/rating
//        → Liste les avis du partenaire connecté (historique)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { resend, FROM } from "@/lib/resend";

const SCOPES = new Set(["global", "plateforme", "support", "commission", "process"]);
const ADMIN_NOTIF_EMAILS = ["alexandre@qlower.com", "coline@qlower.com"];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";

async function getAuthedPartner(request: NextRequest): Promise<{
  user_id: string;
  email: string;
  partner_id: string;
  partner_nom: string;
} | { error: NextResponse }> {
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
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  let partnerId = (meta?.partner_id as string | undefined) || null;

  const sb = createServiceClient();
  // Fallback : lookup via user_id si pas dans metadata
  if (!partnerId) {
    const { data } = await sb.from("partners").select("id").eq("user_id", user.id).maybeSingle();
    partnerId = data?.id || null;
  }
  if (!partnerId) {
    return { error: NextResponse.json({ error: "No partner linked to your account" }, { status: 403 }) };
  }

  const { data: partner } = await sb.from("partners").select("nom").eq("id", partnerId).maybeSingle();
  return {
    user_id: user.id,
    email: user.email || "",
    partner_id: partnerId,
    partner_nom: partner?.nom || "—",
  };
}

export async function POST(request: NextRequest) {
  const a = await getAuthedPartner(request);
  if ("error" in a) return a.error;

  let body: { rating?: number; scope?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rating = Math.round(Number(body.rating || 0));
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }
  const scope = body.scope && SCOPES.has(body.scope) ? body.scope : "global";
  const comment = (body.comment || "").trim().slice(0, 4000);

  const sb = createServiceClient();
  const { data: inserted, error } = await sb
    .from("partner_ratings")
    .insert({
      partner_id: a.partner_id,
      user_id: a.user_id,
      author_email: a.email,
      rating,
      scope,
      comment: comment || null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notif email admin — non-bloquant
  notifyAdminNewRating({ partnerNom: a.partner_nom, authorEmail: a.email, rating, scope, comment }).catch(() => {});

  return NextResponse.json({ ok: true, id: inserted.id, created_at: inserted.created_at });
}

export async function GET(request: NextRequest) {
  const a = await getAuthedPartner(request);
  if ("error" in a) return a.error;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("partner_ratings")
    .select("id, rating, scope, comment, created_at")
    .eq("partner_id", a.partner_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ratings: data || [] });
}

async function notifyAdminNewRating(input: {
  partnerNom: string;
  authorEmail: string;
  rating: number;
  scope: string;
  comment: string;
}) {
  const stars = "🍀".repeat(input.rating) + "·".repeat(5 - input.rating);
  const link = `${SITE_URL}/admin/avis`;
  const subject = `${stars} Nouvel avis ${input.partnerNom} — ${input.rating}/5`;
  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F7FAFC;padding:24px;color:#0A3855">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #E5EDF1;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#FFF5ED;border-bottom:1px solid #F6CCA4">
      <h1 style="margin:0;font-size:18px">🍀 Nouvel avis interne reçu</h1>
      <p style="margin:6px 0 0;color:#6B4D2D;font-size:13px">de <strong>${escapeHtml(input.partnerNom)}</strong> (${escapeHtml(input.authorEmail)})</p>
    </div>
    <div style="padding:20px 24px">
      <div style="font-size:24px;letter-spacing:4px;margin-bottom:8px">${stars}</div>
      <p style="font-size:13px;color:#64748B;margin:0 0 12px">Périmètre : <strong>${escapeHtml(input.scope)}</strong></p>
      ${input.comment ? `<blockquote style="margin:0;padding:12px 16px;background:#F8FAFC;border-left:3px solid #0A3855;border-radius:4px;font-style:italic;color:#334155">"${escapeHtml(input.comment)}"</blockquote>` : "<p style='color:#94A3B8;font-style:italic;font-size:13px'>(pas de commentaire)</p>"}
      <div style="margin-top:24px"><a href="${link}" style="display:inline-block;padding:10px 20px;background:#0A3855;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Ouvrir l'admin avis →</a></div>
    </div>
  </div>
</body></html>`;
  await resend.emails.send({ from: FROM, to: ADMIN_NOTIF_EMAILS, subject, html });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
