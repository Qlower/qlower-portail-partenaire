// GET /api/partner/campaigns?partner_id=xxx
// Historique des communications (campagnes) que Qlower a envoyées à CE partenaire.
// Lecture seule, authentifiée (verifyPartnerAccess). Résout les variables {{...}}
// du template avec les infos du partenaire pour un aperçu lisible.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyPartnerAccess } from "@/lib/partner-auth";
import { buildSignupLink } from "@/services/links";

function replaceVars(text: string, vars: Record<string, string>): string {
  return (text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");

  const access = await verifyPartnerAccess(request, partnerId);
  if (access.error) return access.error;

  const supabase = createServiceClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("nom, contact_prenom, code, utm")
    .eq("id", partnerId)
    .maybeSingle();

  const { data: sends, error } = await supabase
    .from("campaign_sends")
    .select("id, subject, body, sent_at")
    .contains("partner_ids", [partnerId])
    .order("sent_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lien = buildSignupLink(partner?.utm || "", partner?.code || null);
  const vars: Record<string, string> = {
    prenom: partner?.contact_prenom?.trim() || partner?.nom || "",
    nom: partner?.nom || "",
    code: partner?.code || "",
    utm: partner?.utm || "",
    lien,
    lien_affiliation: lien,
  };

  const campaigns = (sends || []).map((s) => ({
    id: s.id,
    subject: replaceVars(s.subject || "", vars),
    body: replaceVars(s.body || "", vars),
    sent_at: s.sent_at,
  }));

  return NextResponse.json({ campaigns });
}
