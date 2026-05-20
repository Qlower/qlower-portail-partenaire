// Notifications email pour le tour de contrôle Sales.
//
// Déclencheurs :
//   - Un négo flag une attribution → notif à tous les sales_admin + commercial actuel
//   - L'admin retire un flag (arbitrage) → notif au flagger
//   - L'admin override (change l'attribution) → notif à ancien + nouveau commercial
//     ET au flagger éventuel si la ligne était contestée
//
// Important : ces notifications viennent de la "Tour de contrôle" (INTERNAL_FROM),
// PAS de Coline. Reply-To pointe vers l'email de l'acteur (manager / négo) pour
// que les éventuelles réponses soient routées à la bonne personne.
//
// Best-effort : si Resend ou la fetch échoue, on swallow l'erreur (le métier
// continue de fonctionner) — log côté serveur uniquement.

import { resend, INTERNAL_FROM } from "@/lib/resend";
import { createServiceClient } from "@/lib/supabase-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";

interface NotifyFlagInput {
  chargeId: string;
  flagged: boolean;
  byEmail: string; // email of the person who set/unset the flag
  byName: string;
  reason?: string | null;
}

export async function notifyFlagChange(input: NotifyFlagInput): Promise<void> {
  try {
    const sb = createServiceClient();

    // Fetch the row + run for context
    const { data: row } = await sb
      .from("attribution_rows")
      .select("charge_id, email, amount_net_eur, run_id, auto_commercial_id, override_commercial_id")
      .eq("charge_id", input.chargeId)
      .maybeSingle();
    if (!row) return;

    const { data: run } = await sb
      .from("monthly_runs")
      .select("year_month")
      .eq("id", row.run_id)
      .maybeSingle();
    const yearMonth = run?.year_month || "";

    // Effective commercial → name + role
    const effectiveCid = row.override_commercial_id || row.auto_commercial_id;
    const { data: effective } = effectiveCid
      ? await sb
          .from("commercials")
          .select("name, email, role")
          .eq("id", effectiveCid)
          .maybeSingle()
      : { data: null };

    // Recipients : all sales_admin users + the current commercial (if email
    // exists and not the flagger themselves).
    const { data: admins } = await sb
      .from("commercials")
      .select("email")
      .eq("role", "sales_admin")
      .eq("active", true);
    const recipientSet = new Set<string>();
    for (const a of admins || []) {
      if (a.email && a.email !== input.byEmail) recipientSet.add(a.email);
    }
    if (effective?.email && effective.email !== input.byEmail) {
      recipientSet.add(effective.email);
    }
    const recipients = [...recipientSet];
    if (recipients.length === 0) return;

    const amountStr = `${Math.round(row.amount_net_eur).toLocaleString("fr-FR")} €`;
    const link = `${SITE_URL}/sales/admin/attribution?ym=${yearMonth}`;
    const subject = input.flagged
      ? `🚩 ${input.byName} a contesté une attribution (${amountStr})`
      : `✅ Contestation retirée par ${input.byName} (${amountStr})`;

    const reasonBlock = input.flagged && input.reason
      ? `<p style="margin:12px 0;padding:12px;background:#FFF7ED;border-left:3px solid #F97316;border-radius:4px;color:#9A3412;font-size:13px;"><strong>Motif :</strong> ${escapeHtml(input.reason)}</p>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F7FAFC;padding:24px;color:#0A3855">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #E5EDF1;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:${input.flagged ? "#FFF7ED" : "#F0FDF4"};border-bottom:1px solid #E5EDF1">
      <h1 style="margin:0;font-size:18px;color:${input.flagged ? "#9A3412" : "#15803D"}">${input.flagged ? "🚩 Attribution contestée" : "✅ Contestation retirée"}</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:13px">par <strong>${escapeHtml(input.byName)}</strong></p>
    </div>
    <div style="padding:20px 24px">
      <table style="width:100%;font-size:14px;color:#334155">
        <tr><td style="padding:4px 0;color:#94A3B8;width:120px">Client</td><td style="font-family:monospace">${escapeHtml(row.email || "—")}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Montant</td><td><strong>${amountStr}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Attribution actuelle</td><td>${escapeHtml(effective?.name || "Non attribué")}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Mois</td><td>${escapeHtml(yearMonth)}</td></tr>
      </table>
      ${reasonBlock}
      <div style="margin-top:24px">
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#0A3855;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Ouvrir l'attribution →</a>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#94A3B8">
        ${input.flagged
          ? "Cet email t'est envoyé parce que tu es manager ou commercial concerné par la ligne contestée. Tu peux arbitrer en changeant l'attribution dans le portail."
          : "Cet email t'est envoyé parce que tu es manager ou commercial concerné par la ligne."}
      </p>
      <p style="margin-top:8px;font-size:11px;color:#94A3B8;font-style:italic">
        Réponds directement à cet email pour échanger avec ${escapeHtml(input.byName)}.
      </p>
    </div>
  </div>
</body></html>`;

    await resend.emails.send({
      from: INTERNAL_FROM,
      to: recipients,
      replyTo: input.byEmail,
      subject,
      html,
    });
  } catch (e) {
    console.error("[notifyFlagChange] failed", e);
    // Swallow — la notif est un nice-to-have, pas un bloquant
  }
}

interface NotifyOverrideInput {
  chargeId: string;
  toCommercialName: string;
  toCommercialId: string | null;
  fromCommercialName: string;
  fromCommercialId: string | null;
  byEmail: string;
  byName: string;
  comment?: string | null;
  wasFlagged: boolean;
}

/**
 * Quand l'admin change l'attribution (override) d'une ligne, on notifie :
 *   - L'ANCIEN propriétaire (perd la vente) — copy adaptée
 *   - Le NOUVEAU propriétaire (récupère la vente) — copy adaptée
 *   - Le flagger si la ligne était contestée — copy "arbitrage rendu"
 * Tous reçoivent un mail séparé avec un wording personnalisé.
 *
 * Skip si l'acteur de l'override est lui-même la cible (pas de self-notif).
 */
export async function notifyAttributionChange(input: NotifyOverrideInput): Promise<void> {
  try {
    const sb = createServiceClient();

    const { data: row } = await sb
      .from("attribution_rows")
      .select("charge_id, email, amount_net_eur, run_id, flagged_by")
      .eq("charge_id", input.chargeId)
      .maybeSingle();
    if (!row) return;

    const { data: run } = await sb
      .from("monthly_runs")
      .select("year_month")
      .eq("id", row.run_id)
      .maybeSingle();
    const yearMonth = run?.year_month || "";
    const amountStr = `${Math.round(row.amount_net_eur).toLocaleString("fr-FR")} €`;
    const clientEmail = row.email || "—";

    // Récupère les emails des 2 commerciaux concernés + flagger éventuel
    const involvedIds = [input.fromCommercialId, input.toCommercialId].filter(Boolean) as string[];
    const { data: commercials } = involvedIds.length > 0
      ? await sb.from("commercials").select("id, email, name").in("id", involvedIds)
      : { data: [] as Array<{ id: string; email: string; name: string }> };
    const emailById = new Map((commercials || []).map((c) => [c.id, c.email]));
    const fromEmail = input.fromCommercialId ? emailById.get(input.fromCommercialId) : null;
    const toEmail = input.toCommercialId ? emailById.get(input.toCommercialId) : null;

    let flaggerEmail: string | null = null;
    let flaggerName: string | null = null;
    if (input.wasFlagged && row.flagged_by) {
      const { data: flagger } = await sb
        .from("commercials")
        .select("email, name")
        .eq("user_id", row.flagged_by)
        .maybeSingle();
      flaggerEmail = flagger?.email || null;
      flaggerName = flagger?.name || null;
    }

    // ─── Envois ────────────────────────────────────────────────────────
    const sends: Array<Promise<unknown>> = [];

    // 1) Ancien propriétaire : "Tu n'es plus attribué sur cette vente"
    if (fromEmail && fromEmail !== input.byEmail) {
      sends.push(
        sendOwnershipMail({
          to: fromEmail,
          variant: "lost",
          byName: input.byName,
          byEmail: input.byEmail,
          clientEmail,
          amountStr,
          yearMonth,
          fromName: input.fromCommercialName,
          toName: input.toCommercialName,
          comment: input.comment,
        }),
      );
    }

    // 2) Nouveau propriétaire : "Une vente t'a été attribuée"
    if (toEmail && toEmail !== input.byEmail && toEmail !== fromEmail) {
      sends.push(
        sendOwnershipMail({
          to: toEmail,
          variant: "gained",
          byName: input.byName,
          byEmail: input.byEmail,
          clientEmail,
          amountStr,
          yearMonth,
          fromName: input.fromCommercialName,
          toName: input.toCommercialName,
          comment: input.comment,
        }),
      );
    }

    // 3) Flagger (si différent des 2 autres) : "Arbitrage rendu sur ta contestation"
    if (
      flaggerEmail &&
      flaggerEmail !== input.byEmail &&
      flaggerEmail !== fromEmail &&
      flaggerEmail !== toEmail
    ) {
      sends.push(
        sendArbitrationMail({
          to: flaggerEmail,
          flaggerName: flaggerName || flaggerEmail,
          byName: input.byName,
          byEmail: input.byEmail,
          clientEmail,
          amountStr,
          yearMonth,
          fromName: input.fromCommercialName,
          toName: input.toCommercialName,
          comment: input.comment,
        }),
      );
    }

    await Promise.allSettled(sends);
  } catch (e) {
    console.error("[notifyAttributionChange] failed", e);
  }
}

/**
 * Backward compat : ancien nom utilisé par les routes — on déprécie ensuite.
 * @deprecated Use notifyAttributionChange.
 */
export async function notifyOverrideOnFlaggedRow(input: {
  chargeId: string;
  toCommercialName: string;
  fromCommercialName: string;
  byEmail: string;
  byName: string;
  comment?: string | null;
}): Promise<void> {
  await notifyAttributionChange({
    ...input,
    toCommercialId: null,
    fromCommercialId: null,
    wasFlagged: true,
  });
}

// ─── Mail "ownership change" (ancien / nouveau propriétaire) ────────────────
interface OwnershipMailInput {
  to: string;
  variant: "lost" | "gained";
  byName: string;
  byEmail: string;
  clientEmail: string;
  amountStr: string;
  yearMonth: string;
  fromName: string;
  toName: string;
  comment?: string | null;
}

async function sendOwnershipMail(input: OwnershipMailInput): Promise<void> {
  const link = `${SITE_URL}/sales/ventes?ym=${input.yearMonth}`;
  const isGained = input.variant === "gained";

  const subject = isGained
    ? `📥 Nouvelle vente attribuée par ${input.byName} (${input.amountStr})`
    : `📤 Vente réattribuée par ${input.byName} (${input.amountStr})`;

  const bgColor = isGained ? "#F0FDF4" : "#FEF2F2";
  const titleColor = isGained ? "#15803D" : "#991B1B";
  const title = isGained ? "📥 Une vente t'a été attribuée" : "📤 Une vente t'a été retirée";

  const intro = isGained
    ? `Le manager <strong>${escapeHtml(input.byName)}</strong> vient de t'attribuer une vente.`
    : `Le manager <strong>${escapeHtml(input.byName)}</strong> a réattribué une vente que tu avais.`;

  const commentBlock = input.comment
    ? `<p style="margin:12px 0;padding:12px;background:#F0F9FF;border-left:3px solid #0EA5E9;border-radius:4px;color:#075985;font-size:13px;"><strong>Note du manager :</strong> ${escapeHtml(input.comment)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F7FAFC;padding:24px;color:#0A3855">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #E5EDF1;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:${bgColor};border-bottom:1px solid #E5EDF1">
      <h1 style="margin:0;font-size:18px;color:${titleColor}">${title}</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:13px">par <strong>${escapeHtml(input.byName)}</strong></p>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:14px;color:#334155;margin:0 0 16px">${intro}</p>
      <table style="width:100%;font-size:14px;color:#334155;margin-bottom:16px">
        <tr><td style="padding:4px 0;color:#94A3B8;width:120px">Client</td><td style="font-family:monospace">${escapeHtml(input.clientEmail)}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Montant</td><td><strong>${input.amountStr}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8">Mois</td><td>${escapeHtml(input.yearMonth)}</td></tr>
      </table>
      <div style="padding:16px;background:#F8FAFC;border:1px solid #E5EDF1;border-radius:8px;margin:0 0 16px">
        <div style="font-size:13px;color:#64748B">Avant</div>
        <div style="font-size:15px;font-weight:500;margin-bottom:12px">${escapeHtml(input.fromName)}</div>
        <div style="font-size:13px;color:#64748B">Après</div>
        <div style="font-size:15px;font-weight:600;color:#0A3855">${escapeHtml(input.toName)}</div>
      </div>
      ${commentBlock}
      <div style="margin-top:24px">
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#0A3855;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Voir mes ventes →</a>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#94A3B8;font-style:italic">
        Réponds directement à cet email pour échanger avec ${escapeHtml(input.byName)}.
      </p>
    </div>
  </div>
</body></html>`;

  await resend.emails.send({
    from: INTERNAL_FROM,
    to: input.to,
    replyTo: input.byEmail,
    subject,
    html,
  });
}

// ─── Mail "arbitrage rendu" (flagger d'origine) ─────────────────────────────
interface ArbitrationMailInput {
  to: string;
  flaggerName: string;
  byName: string;
  byEmail: string;
  clientEmail: string;
  amountStr: string;
  yearMonth: string;
  fromName: string;
  toName: string;
  comment?: string | null;
}

async function sendArbitrationMail(input: ArbitrationMailInput): Promise<void> {
  const link = `${SITE_URL}/sales/ventes?ym=${input.yearMonth}`;
  const subject = `✏️ ${input.byName} a tranché sur ta contestation (${input.amountStr})`;

  const commentBlock = input.comment
    ? `<p style="margin:12px 0;padding:12px;background:#F0F9FF;border-left:3px solid #0EA5E9;border-radius:4px;color:#075985;font-size:13px;"><strong>Note du manager :</strong> ${escapeHtml(input.comment)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F7FAFC;padding:24px;color:#0A3855">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #E5EDF1;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#F0F9FF;border-bottom:1px solid #E5EDF1">
      <h1 style="margin:0;font-size:18px;color:#075985">✏️ Arbitrage du manager</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:13px">par <strong>${escapeHtml(input.byName)}</strong></p>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:14px;color:#334155;margin:0 0 16px">
        Tu avais contesté l'attribution sur <strong>${escapeHtml(input.clientEmail)}</strong> (${input.amountStr}).
        Le manager a tranché :
      </p>
      <div style="padding:16px;background:#F8FAFC;border:1px solid #E5EDF1;border-radius:8px;margin:0 0 16px">
        <div style="font-size:13px;color:#64748B">Avant</div>
        <div style="font-size:15px;font-weight:500;margin-bottom:12px">${escapeHtml(input.fromName)}</div>
        <div style="font-size:13px;color:#64748B">Après</div>
        <div style="font-size:15px;font-weight:600;color:#0A3855">${escapeHtml(input.toName)}</div>
      </div>
      ${commentBlock}
      <div style="margin-top:24px">
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#0A3855;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Ouvrir le tour de contrôle →</a>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#94A3B8;font-style:italic">
        Réponds directement à cet email pour échanger avec ${escapeHtml(input.byName)}.
      </p>
    </div>
  </div>
</body></html>`;

  await resend.emails.send({
    from: INTERNAL_FROM,
    to: input.to,
    replyTo: input.byEmail,
    subject,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
