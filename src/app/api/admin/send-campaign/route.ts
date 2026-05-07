import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { resend, FROM } from "@/lib/resend";
import { layout } from "@/services/emailTemplates";
import { verifyAdmin } from "@/lib/admin-auth";
import { generateSetupPasswordLink } from "@/lib/setup-token";

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { templateKey, audience, partnerIds, confirm, expectedRecipientCount } = body as {
    templateKey: string;
    audience?: string;
    partnerIds?: string[];
    confirm?: boolean;
    expectedRecipientCount?: number;
  };

  if (!templateKey) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  // Defense in depth : un envoi de campagne réelle est irréversible.
  // On exige un flag explicite { confirm: true } + un nombre attendu de
  // destinataires. Si le frontend (modal) ne l'envoie pas, on refuse —
  // y compris si quelqu'un appelle l'API en curl par accident.
  if (confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation requise. Envoi refusé sans { confirm: true }." },
      { status: 400 },
    );
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

  // Cross-check entre ce que le user voit dans la modal et ce que le serveur
  // s'apprête à envoyer. Si la liste a changé (partenaire ajouté/désactivé
  // entre l'ouverture de la modal et la confirmation), on refuse pour ne pas
  // envoyer à un autre périmètre que celui validé.
  const eligiblePartners = (partners ?? []).filter((p) => p.email);
  if (
    typeof expectedRecipientCount === "number" &&
    expectedRecipientCount !== eligiblePartners.length
  ) {
    return NextResponse.json(
      {
        error: `Liste des destinataires modifiée depuis la confirmation : attendu ${expectedRecipientCount}, trouvé ${eligiblePartners.length}. Recharge la page et reconfirme.`,
      },
      { status: 409 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";
  const results = await Promise.allSettled(
    (partners ?? [])
      .filter((p) => p.email)
      .map(async (p) => {
        const link = `https://www.qlower.com/qlower-x-partenaire?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}`;

        // Setup-password link 7j (NOT consumed by email scanners) — preferred for new comm
        let setupLink = `${siteUrl}/login`;
        try {
          const generated = await generateSetupPasswordLink(p.email!);
          if (generated) setupLink = generated;
        } catch {
          // fallback déjà sur /login
        }

        // Magic link 24h (legacy, gardé pour compat)
        let magicLink = setupLink; // fallback to setup link
        try {
          const { data: linkData } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: p.email!,
            options: { redirectTo: `${siteUrl}/auth/magic` },
          });
          if (linkData?.properties?.action_link) {
            magicLink = linkData.properties.action_link;
          }
        } catch {
          // fallback déjà sur setupLink
        }

        const vars: Record<string, string> = {
          nom: p.nom,
          email: p.email!,
          utm: p.utm,
          code: p.code,
          leads: String(p.leads ?? 0),
          abonnes: String(p.abonnes ?? 0),
          link,
          setup_link: setupLink,
          magic_link: magicLink,
        };

        const subject = replaceVars(template.subject, vars);
        const html = layout(replaceVars(template.body, vars));

        await resend.emails.send({ from: FROM, to: p.email!, subject, html });
        return p.id;
      })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Log the campaign send for the history view
  const recipientIds = (partners ?? []).filter((p) => p.email).map((p) => p.id);
  await supabase.from("campaign_sends").insert({
    template_id: templateKey,
    subject: template.subject,
    body: template.body,
    partner_ids: recipientIds,
    partner_count: recipientIds.length,
    sent_count: sent,
    failed_count: failed,
  });

  return NextResponse.json({ sent, failed });
}
