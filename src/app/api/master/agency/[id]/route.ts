// GET /api/master/agency/[id]
//
// Détail d'une agence pour le master — avec contrôle d'appartenance au réseau
// (l'agence doit appartenir au network_id du master connecté). Anonymisé :
// agrégats + répartition mensuelle, jamais de nom/email client.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyMaster } from "@/lib/master-auth";

export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyMaster(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const sb = createServiceClient();

  // Ownership : l'agence doit être dans le réseau du master.
  const { data: partner } = await sb
    .from("partners")
    .select("id, nom, code, network_id, leads, abonnes")
    .eq("id", id)
    .maybeSingle();
  if (!partner || partner.network_id !== auth.networkId) {
    return NextResponse.json({ error: "Agence hors de votre réseau" }, { status: 403 });
  }

  // Leads de l'agence (anonymisé : on ne renvoie ni nom ni email).
  const { data: leads } = await sb
    .from("leads")
    .select("stage, commission_due, created_at, subscribed_at")
    .eq("partner_id", id);
  const leadList = leads || [];

  // Répartition mensuelle : contacts (created_at) vs bailleurs (subscribed_at).
  const byMonth = new Map<string, { leads: number; bailleurs: number }>();
  const bump = (m: string, k: "leads" | "bailleurs") => {
    if (!m) return;
    const cur = byMonth.get(m) || { leads: 0, bailleurs: 0 };
    cur[k]++;
    byMonth.set(m, cur);
  };
  const ym = (d: string | null) => (d ? d.slice(0, 7) : "");
  for (const l of leadList) {
    bump(ym(l.created_at), "leads");
    if (l.subscribed_at) bump(ym(l.subscribed_at), "bailleurs");
  }
  const months = [...byMonth.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // CA généré (match attribution_rows par email des leads de l'agence).
  let ca = 0;
  const { data: leadEmails } = await sb
    .from("leads")
    .select("email")
    .eq("partner_id", id)
    .not("email", "is", null);
  const emails = [...new Set((leadEmails || []).map((l) => l.email as string))];
  const emailsLc = new Set(emails.map((e) => e.toLowerCase()));
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const { data: rows } = await sb
      .from("attribution_rows")
      .select("email, amount_net_eur")
      .in("email", chunk);
    for (const r of rows || []) {
      if (!emailsLc.has((r.email || "").toLowerCase())) continue;
      const amt = Number(r.amount_net_eur) || 0;
      if (amt > 0) ca += amt;
    }
  }

  return NextResponse.json({
    agency: { id: partner.id, nom: partner.nom, code: partner.code },
    totals: {
      bailleurs: partner.abonnes || 0,
      leads: partner.leads || leadList.length,
      ca: Math.round(ca),
    },
    months,
  });
}
