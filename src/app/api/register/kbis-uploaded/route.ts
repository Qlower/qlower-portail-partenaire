// POST /api/register/kbis-uploaded
// Body : { partnerId, kbisUrl }
//
// Appelé par le client APRÈS un upload Kbis réussi. Envoie une notif courte
// à Coline avec le lien Kbis (puisque /api/register avait été notifié sans
// Kbis car uploadé après).
//
// Public (pas d'auth) car appelé par le client en cours d'inscription.
// On valide juste que le partenaire existe.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partnerId, kbisUrl } = body as { partnerId: string; kbisUrl: string };
    if (!partnerId || !kbisUrl) {
      return NextResponse.json({ error: "partnerId et kbisUrl requis" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: partner, error } = await supabase
      .from("partners")
      .select("nom, contact_prenom, contact_nom, email")
      .eq("id", partnerId)
      .single();
    if (error || !partner) {
      return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });
    }

    // Met à jour kbis_url côté partenaire (au cas où le client n'a pas eu le temps)
    await supabase.from("partners").update({ kbis_url: kbisUrl }).eq("id", partnerId);

    // Envoie une notif courte à Coline + Alex
    const { resend, FROM } = await import("@/lib/resend");
    await resend.emails.send({
      from: FROM,
      to: "coline@qlower.com",
      cc: "alexandre@qlower.com",
      subject: `📎 Kbis reçu — ${partner.nom}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#0A3855;margin:0 0 12px;">Kbis reçu pour ${partner.nom}</h2>
        <p style="color:#374151;line-height:1.6;">
          ${partner.contact_prenom || ""} ${partner.contact_nom || ""}
          ${partner.email ? ` (<a href="mailto:${partner.email}">${partner.email}</a>)` : ""}
          vient d'uploader son Kbis.
        </p>
        <p style="margin:16px 0;">
          <a href="${kbisUrl}" target="_blank"
             style="display:inline-block;background:#0A3855;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            📎 Ouvrir le Kbis
          </a>
        </p>
        <p style="font-size:11px;color:#999;margin-top:16px;">
          Qlower / ComptAppart SAS — Programme partenaire
        </p>
      </div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[register/kbis-uploaded] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
