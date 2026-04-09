import { NextRequest, NextResponse } from "next/server";
import { resend, FROM } from "@/lib/resend";
import { verifyAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { partnerName, partnerEmail, kbisUrl } = body as {
    partnerName: string;
    partnerEmail: string;
    kbisUrl: string;
  };

  await resend.emails.send({
    from: FROM,
    to: "coline@qlower.com",
    subject: `Nouveau Kbis reçu — ${partnerName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <div style="background:#0A3855;border-radius:12px 12px 0 0;padding:20px 24px;">
          <h2 style="margin:0;font-size:16px;color:#ffffff;">Nouveau Kbis re&ccedil;u</h2>
        </div>
        <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            Bonjour,<br><br>Un nouveau partenaire vient de s'inscrire et a d&eacute;pos&eacute; son Kbis.
          </p>
          <table style="width:100%;font-size:14px;color:#374151;line-height:1.8;margin-bottom:20px;">
            <tr><td style="color:#9ca3af;width:90px;">Partenaire</td><td style="font-weight:600;">${partnerName}</td></tr>
            <tr><td style="color:#9ca3af;">Email</td><td><a href="mailto:${partnerEmail}" style="color:#0A3855;">${partnerEmail}</a></td></tr>
          </table>
          <a href="${kbisUrl}" style="display:inline-block;background:#0A3855;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;">
            Voir le document &rarr;
          </a>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
