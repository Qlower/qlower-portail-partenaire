import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { resend, FROM } from "@/lib/resend";
import { getEmailContent, type TemplateKey } from "@/services/emailTemplates";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { templateKey, audience } = body as { templateKey: TemplateKey; audience: string };

  if (!templateKey) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase.from("partners").select("id, nom, email, utm, code, leads, abonnes, active, contrat");
  query = query.eq("active", true);
  if (audience === "affiliation") query = query.eq("contrat", "affiliation");
  if (audience === "marque_blanche") query = query.eq("contrat", "marque_blanche");

  const { data: partners, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (partners ?? [])
      .filter((p) => p.email)
      .map(async (p) => {
        const { subject, body: text } = getEmailContent(templateKey, {
          nom: p.nom,
          email: p.email!,
          utm: p.utm,
          code: p.code,
          leads: p.leads ?? 0,
          abonnes: p.abonnes ?? 0,
        });

        await resend.emails.send({
          from: FROM,
          to: p.email!,
          subject,
          text,
        });

        return p.id;
      })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}
