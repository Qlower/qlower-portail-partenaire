// Webhook Resend — événements d'emails (ouverture, délivrance, bounce).
// Sert au taux d'ouverture des campagnes (onglet Campagnes admin).
//
// Config côté Resend : Dashboard → Webhooks → ajouter cette URL
//   https://partenaire.qlower.com/api/webhooks/resend
// activer les events email.opened / email.delivered / email.bounced,
// et coller le "Signing Secret" (whsec_…) dans l'env RESEND_WEBHOOK_SECRET.
// + activer l'Open Tracking sur le domaine Resend.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

// Vérifie la signature Svix (format Resend). Retourne true si valide.
function verifySvix(payload: string, headers: Headers): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sig = headers.get("svix-signature");
  if (!id || !ts || !sig || !SECRET) return false;
  try {
    const secretBytes = Buffer.from(SECRET.split("_")[1] || SECRET, "base64");
    const signedContent = `${id}.${ts}.${payload}`;
    const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    // Le header peut contenir plusieurs signatures "v1,xxx v1,yyy"
    const provided = sig.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    return provided.some((p) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  const payload = await request.text();
  if (!verifySvix(payload, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = event.data?.email_id;
  const type = event.type || "";
  if (!messageId) return NextResponse.json({ received: true, skipped: "no_email_id" });

  const now = new Date().toISOString();
  const field =
    type === "email.opened"
      ? "opened_at"
      : type === "email.delivered"
        ? "delivered_at"
        : type === "email.bounced"
          ? "bounced_at"
          : type === "email.complained"
            ? "complained_at"
            : null;
  if (!field) return NextResponse.json({ received: true, skipped: `unhandled_${type}` });

  try {
    const sb = createServiceClient();
    // On ne repousse pas une ouverture déjà enregistrée (garde la 1ère).
    await sb
      .from("campaign_email_events")
      .update({ [field]: now })
      .eq("message_id", messageId)
      .is(field, null);
  } catch (e) {
    console.warn("[resend-webhook] update skipped:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ received: true, type });
}
