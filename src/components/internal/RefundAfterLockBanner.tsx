"use client";

// Bandeau "Remboursements post-clôture" — version interactive avec 3 actions
// par ligne :
//   - 🚫 "La boîte assume" → flag acknowledged_no_clawback, ligne disparaît
//   - ⤺ "Clawback partiel…" → modal avec saisie du montant + motif obligatoire
//                              + aide-mémoire 3% / 5% / 10% du refund
//   - "Retirer" (sur lignes déjà traitées) → annule la décision
//
// L'admin reste maître du montant — le système ne devine pas le taux de
// commission historique du négo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, RotateCcw, Loader2, X } from "lucide-react";

export interface RefundRow {
  charge_id: string;
  email: string;
  amount_refunded_eur: number;
  effective_commercial_name: string | null;
  refund_month: string; // ex: "2026-04"
  clawback_status: string | null; // NULL | acknowledged_no_clawback | applied
  clawback_amount_eur: number | null;
  clawback_decided_by_email: string | null;
  clawback_applied_at: string | null;
  clawback_reason: string | null;
}

interface Props {
  refunds: RefundRow[];
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (refund: number, rate: number) =>
  `${(refund * rate).toFixed(2).replace(".", ",")} €`;

export default function RefundAfterLockBanner({ refunds }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeModal, setActiveModal] = useState<RefundRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pending = refunds.filter((r) => r.clawback_status === null);
  const decided = refunds.filter((r) => r.clawback_status !== null);

  if (refunds.length === 0) return null;

  const callApi = async (
    chargeId: string,
    action: "acknowledge_no_clawback" | "apply" | "cancel",
    extra?: { amount?: number; reason?: string },
  ) => {
    setBusy(chargeId);
    try {
      const res = await fetch(`/api/sales/clawback/${encodeURIComponent(chargeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
      setActiveModal(null);
    }
  };

  const totalRefunded = refunds.reduce((s, r) => s + r.amount_refunded_eur, 0);
  const totalPending = pending.reduce((s, r) => s + r.amount_refunded_eur, 0);

  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3 border-b border-orange-200">
          <AlertTriangle className="size-5 text-orange-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-orange-900">
              Remboursements post-clôture : {refunds.length} ligne{refunds.length > 1 ? "s" : ""}
              {pending.length > 0 && (
                <span className="ml-2 text-xs font-normal bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded">
                  {pending.length} en attente
                </span>
              )}
            </div>
            <p className="text-xs text-orange-800 mt-0.5 leading-relaxed">
              {fmtEur(totalRefunded)} remboursés au total — décide par ligne si la boîte assume
              ou si on décommissionne le négo concerné sur le mois courant.
            </p>
          </div>
        </div>

        {/* Lignes en attente d'arbitrage */}
        {pending.length > 0 && (
          <div className="divide-y divide-orange-100">
            {pending.map((r) => (
              <div key={r.charge_id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.email} —{" "}
                    <span className="font-bold text-orange-700">
                      {fmtEur(r.amount_refunded_eur)}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Vente {r.refund_month} · attribuée à <strong>{r.effective_commercial_name || "—"}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      callApi(r.charge_id, "acknowledge_no_clawback", {
                        reason: "La boîte assume",
                      })
                    }
                    disabled={!!busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    title="Aucun clawback : la boîte assume l'erreur, le négo garde son commissionnement"
                  >
                    {busy === r.charge_id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <>🚫 La boîte assume</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(r)}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-100 border border-orange-200 text-orange-800 hover:bg-orange-200"
                    title="Créer une ligne négative dans le mois courant pour décommissionner"
                  >
                    <RotateCcw className="size-3" />
                    Clawback partiel…
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lignes déjà traitées (repliable) */}
        {decided.length > 0 && (
          <details className="border-t border-orange-200 bg-white/50">
            <summary className="px-4 py-2 text-xs text-gray-600 cursor-pointer hover:bg-orange-50">
              {decided.length} décision{decided.length > 1 ? "s" : ""} déjà prise{decided.length > 1 ? "s" : ""} (cliquer pour voir)
            </summary>
            <div className="divide-y divide-gray-100">
              {decided.map((r) => (
                <div key={r.charge_id} className="px-4 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">
                      {r.email} — {fmtEur(r.amount_refunded_eur)} remboursés
                    </p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                      {r.clawback_status === "applied" ? (
                        <span className="inline-flex items-center gap-0.5 text-red-700 font-medium">
                          <RotateCcw className="size-2.5" />
                          Clawback −{fmtEur(r.clawback_amount_eur || 0)} appliqué
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-gray-600">
                          <Check className="size-2.5" />
                          La boîte assume
                        </span>
                      )}
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">
                        par {r.clawback_decided_by_email || "?"}{" "}
                        {r.clawback_applied_at &&
                          new Date(r.clawback_applied_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                          })}
                      </span>
                      {r.clawback_reason && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span className="italic">{r.clawback_reason}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm("Annuler cette décision ? La ligne réapparaîtra dans la liste à traiter.")) return;
                      callApi(r.charge_id, "cancel");
                    }}
                    disabled={!!busy}
                    className="text-[11px] text-gray-500 hover:text-rose-600 underline-offset-2 hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Footer si tout est décidé */}
        {pending.length === 0 && (
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-800 flex items-center gap-1.5">
            <Check className="size-3.5" />
            Toutes les décisions sont prises.
          </div>
        )}

        {/* Récap pending */}
        {pending.length > 0 && (
          <div className="px-4 py-2 bg-orange-100 text-xs text-orange-900 flex items-center justify-between">
            <span>
              <strong>{fmtEur(totalPending)}</strong> de remboursements en attente d&apos;arbitrage
            </span>
          </div>
        )}
      </div>

      {/* Modal Clawback partiel */}
      {activeModal && (
        <ClawbackModal
          refund={activeModal}
          busy={busy === activeModal.charge_id}
          onCancel={() => setActiveModal(null)}
          onApply={(amount, reason) =>
            callApi(activeModal.charge_id, "apply", { amount, reason })
          }
        />
      )}
    </>
  );
}

function ClawbackModal({
  refund,
  busy,
  onCancel,
  onApply,
}: {
  refund: RefundRow;
  busy: boolean;
  onCancel: () => void;
  onApply: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>(
    `Clawback ${refund.effective_commercial_name || ""} suite au refund de ${refund.email}`,
  );
  const numericAmount = Number(amount);
  const canSubmit =
    !busy && !isNaN(numericAmount) && numericAmount > 0 && reason.trim().length >= 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-[#0A3855] flex items-center gap-2">
            <RotateCcw className="size-4 text-orange-600" />
            Clawback sur le mois courant
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-gray-50 rounded p-2.5 mb-3 text-[11px] text-gray-600 leading-relaxed">
          <p><strong>Refund :</strong> {fmtEur(refund.amount_refunded_eur)}</p>
          <p><strong>Vente :</strong> {refund.refund_month} — {refund.email}</p>
          <p><strong>Commercial concerné :</strong> {refund.effective_commercial_name || "—"}</p>
        </div>

        <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
          Montant à décommissionner (en CA équivalent)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex: 13.45"
            min={0}
            step={0.01}
            className="flex-1 rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-mono"
            autoFocus
          />
          <span className="text-sm text-gray-500">€</span>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded p-2.5 mt-3 text-[11px] text-blue-900 leading-relaxed">
          <p className="font-semibold mb-1">💡 Aide-mémoire (taux × montant remboursé) :</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setAmount(String((refund.amount_refunded_eur * 0.03).toFixed(2)))}
              className="block text-left hover:underline w-full"
            >
              • Si <strong>3%</strong> (obj. non atteint) → {fmtPct(refund.amount_refunded_eur, 0.03)}
            </button>
            <button
              type="button"
              onClick={() => setAmount(String((refund.amount_refunded_eur * 0.05).toFixed(2)))}
              className="block text-left hover:underline w-full"
            >
              • Si <strong>5%</strong> (obj. atteint) → {fmtPct(refund.amount_refunded_eur, 0.05)}
            </button>
            <button
              type="button"
              onClick={() => setAmount(String((refund.amount_refunded_eur * 0.10).toFixed(2)))}
              className="block text-left hover:underline w-full"
            >
              • Si <strong>10%</strong> (obj. dépassé) → {fmtPct(refund.amount_refunded_eur, 0.10)}
            </button>
            <button
              type="button"
              onClick={() => setAmount(String(refund.amount_refunded_eur))}
              className="block text-left hover:underline w-full"
            >
              • <strong>CA total</strong> remboursé → {fmtEur(refund.amount_refunded_eur)}
            </button>
          </div>
        </div>

        <label className="block mt-3 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
          Motif (obligatoire, 5 caractères min)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
        />

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
            disabled={busy}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onApply(numericAmount, reason.trim())}
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? (
              <><Loader2 className="size-3.5 animate-spin" /> Application…</>
            ) : (
              <>Appliquer le clawback</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
