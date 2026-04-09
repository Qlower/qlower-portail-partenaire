import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { resend, FROM } from "@/lib/resend";
import { layout } from "@/services/emailTemplates";
import { verifyAdmin } from "@/lib/admin-auth";

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { templateKey, audience, partnerIds } = body as {
    templateKey: string;
    audience?: string;
    partnerIds?: string[];
  };

  if (!templateKey) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Load template from Supabase
  const { data: template, error: tplError } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", templateKey)
    .single();

  if (tplError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Load partners
  let query = supabase.from("partners").select("id, nom, email, utm, code, leads, abonnes, active, contrat");

  if (partnerIds && partnerIds.length > 0) {
    // Explicit list of partner IDs
    query = query.in("id", partnerIds);
  } else {
    // Audience-based filtering (legacy)
    query = query.eq("active", true);
    if (audience === "affiliation") query = query.eq("contrat", "affiliation");
    if (audience === "marque_blanche") query = query.eq("contrat", "marque_blanche");
  }

  const { data: partners, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (partners ?? [])
      .filter((p) => p.email)
      .map(async (p) => {
        const link = `https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}`;
        const vars: Record<string, string> = {
          nom: p.nom,
          email: p.email!,
          utm: p.utm,
          code: p.code,
          leads: String(p.leads ?? 0),
          abonnes: String(p.abonnes ?? 0),
          link,
        };

        const subject = replaceVars(template.subject, vars);
        const html = layout(replaceVars(template.body, vars));

        await resend.emails.send({ from: FROM, to: p.email!, subject, html });
        return p.id;
      })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}
