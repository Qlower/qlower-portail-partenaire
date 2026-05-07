// Auto-lock du mois précédent — invoqué par le cron quotidien à 9h.
//
// Règle : le 5 de chaque mois M, on verrouille automatiquement le mois M-1.
// Donne 5 jours pleins à l'équipe pour arbitrer les contestations restantes
// avant clôture définitive.
//
// Idempotent : si déjà verrouillé, no-op. Si on n'est pas le 5, no-op.
// Le manager peut toujours déverrouiller manuellement via le LockMonthButton
// (avec une raison enregistrée).

import { createServiceClient } from "@/lib/supabase-server";
import { resend, FROM } from "@/lib/resend";
import { shiftYearMonth, currentYearMonth, formatYearMonthFull } from "@/lib/year-month";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";
// Jour du mois auquel on verrouille (UTC). Configurable via env.
const AUTO_LOCK_DAY = parseInt(process.env.AUTO_LOCK_DAY_OF_MONTH || "5", 10);

export interface AutoLockResult {
  ranOn: string;            // ISO date du run
  yearMonth: string | null; // mois ciblé (M-1) ou null si no-op
  locked: boolean;          // true si on vient de verrouiller (false si déjà locked / no-op)
  reason?: string;          // explication si locked=false
  notifSent?: number;       // nb d'emails de notif envoyés
}

export async function autoLockPreviousMonth(): Promise<AutoLockResult> {
  const now = new Date();
  const ranOn = now.toISOString();
  const dayOfMonth = now.getUTCDate();

  // Garde-fou : ne s'exécute QUE le AUTO_LOCK_DAY (par défaut le 5).
  if (dayOfMonth !== AUTO_LOCK_DAY) {
    return {
      ranOn,
      yearMonth: null,
      locked: false,
      reason: `Pas le ${AUTO_LOCK_DAY} du mois (jour=${dayOfMonth})`,
    };
  }

  const targetMonth = shiftYearMonth(currentYearMonth(now), -1);
  const sb = createServiceClient();

  // Fetch the run
  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", targetMonth)
    .maybeSingle();
  if (!run) {
    return {
      ranOn,
      yearMonth: targetMonth,
      locked: false,
      reason: "Aucun run pour ce mois",
    };
  }
  if (run.locked) {
    return {
      ranOn,
      yearMonth: targetMonth,
      locked: false,
      reason: "Déjà verrouillé",
    };
  }

  // Lock it
  const { error } = await sb
    .from("monthly_runs")
    .update({
      locked: true,
      locked_at: ranOn,
      locked_by: null, // null car action automatique (pas de user_id)
      unlock_reason: null,
    })
    .eq("id", run.id);
  if (error) {
    return {
      ranOn,
      yearMonth: targetMonth,
      locked: false,
      reason: `Erreur SQL: ${error.message}`,
    };
  }

  // Audit history
  await sb.from("attribution_history").insert({
    charge_id: `__monthly_run__${targetMonth}`,
    who: null,
    who_email: "system@qlower.com",
    from_commercial: "ouvert",
    to_commercial: "verrouillé",
    comment: `Verrouillage automatique le ${AUTO_LOCK_DAY} du mois`,
  });

  // Notif aux sales_admins pour qu'ils sachent que le mois est clos.
  // Inclut récap du mois (CA + nb de lignes + 🚩 restantes).
  const notifSent = await notifyAutoLock(targetMonth);

  return {
    ranOn,
    yearMonth: targetMonth,
    locked: true,
    notifSent,
  };
}

async function notifyAutoLock(yearMonth: string): Promise<number> {
  try {
    const sb = createServiceClient();

    // Recap : CA, lignes, contestations
    const { data: run } = await sb
      .from("monthly_runs")
      .select("id, total_net_eur, total_rows")
      .eq("year_month", yearMonth)
      .maybeSingle();
    const { count: rowCount } = await sb
      .from("attribution_rows")
      .select("charge_id", { count: "exact", head: true })
      .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");
    const { data: rows } = await sb
      .from("attribution_rows")
      .select("amount_net_eur, flagged_for_review")
      .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");
    const total = (rows || []).reduce((s, r) => s + (r.amount_net_eur || 0), 0);
    const flagged = (rows || []).filter((r) => r.flagged_for_review).length;

    // Recipients : tous les sales_admin
    const { data: admins } = await sb
      .from("commercials")
      .select("email")
      .eq("role", "sales_admin")
      .eq("active", true);
    const recipients = (admins || []).map((a) => a.email).filter(Boolean) as string[];
    if (recipients.length === 0) return 0;

    const link = `${SITE_URL}/sales/admin/attribution?ym=${yearMonth}`;
    const subject = `🔒 Mois ${formatYearMonthFull(yearMonth)} verrouillé automatiquement`;
    const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F7FAFC;padding:24px;color:#0A3855">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #E5EDF1;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#F1F5F9;border-bottom:1px solid #E5EDF1">
      <h1 style="margin:0;font-size:18px">🔒 Clôture automatique du mois</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:13px">${formatYearMonthFull(yearMonth)}</p>
    </div>
    <div style="padding:20px 24px">
      <table style="width:100%;font-size:14px;color:#334155">
        <tr><td style="padding:4px 0;color:#94A3B8;width:140px">CA équipe</td><td><strong>${Math.round(total).toLocaleString("fr-FR")} €</strong></td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Lignes attribuées</td><td>${rowCount || 0}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Contestations restantes</td><td>${flagged > 0 ? `<span style="color:#F97316;font-weight:600">${flagged} 🚩</span>` : "0"}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#475569">
        Le mois est désormais verrouillé. Les éditions sont bloquées.
        Si tu dois corriger une attribution, déverrouille manuellement
        (avec un motif obligatoire) depuis la page Attribution.
      </p>
      <div style="margin-top:24px">
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#0A3855;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Ouvrir l'attribution →</a>
      </div>
    </div>
  </div>
</body></html>`;

    await resend.emails.send({ from: FROM, to: recipients, subject, html });
    return recipients.length;
  } catch (e) {
    console.error("[auto-lock notif] failed", e);
    return 0;
  }
}
