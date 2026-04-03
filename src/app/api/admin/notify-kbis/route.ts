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
    text: `Bonjour Coline,\n\nUn nouveau partenaire vient de s'inscrire et a déposé son Kbis.\n\nPartenaire : ${partnerName}\nEmail : ${partnerEmail}\n\nLien du document : ${kbisUrl}\n\nÀ très vite,\nQlower`,
  });

  return NextResponse.json({ ok: true });
}
