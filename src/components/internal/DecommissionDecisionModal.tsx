"use client";

// Modal "Décider du décommissionnement" pour une ligne refund ledger.
//
// Workflow :
//   - Question : décommissionner un négo ?
//       Non (défaut) → la boîte/équipe assume, aucun négo impacté
//       Oui → dropdown négo + montant à retenir + motif
//
// Important : le CA du négo ne baisse PAS. Le montant saisi est juste une
// info trackée pour être retenue sur la prochaine paie commission (calcul
// admin manuel parce que le taux historique 3 %/5 %/10 % n'est pas en base).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, AlertTriangle } from "lucide-react";

export interface DecommissionCommercial {
  id: string;
  name: string;
  role: string | null;
}

export interface DecommissionRowData {
  charge_id: string;
  amount_net_eur: number; // négatif (refund)
  email: string;
  description: string | null;
  // État actuel (si déjà décidé)
  decommission_commercial_id: string | null;
  decommission_amount_eur: number | null;
  decommission_reason: string | null;
  decommission_set_by_email: string | null;
  decommission_set_at: string | null;
  // Pour aider l'admin à proposer un défaut : le négo de la vente d'origine
  // (extrait de auto_reason côté serveur ou passé en prop).
  original_commercial_id: string | null;
  original_commercial_name: string | null;
}

interface Props {
  row: DecommissionRowData;
  commercials: DecommissionCommercial[];
  onClose: () => void;
}

const fmtEur = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;

export default function DecommissionDecisionModal({
  row,
  commercials,
  onClose,
}: Props) {
  const router = useRouter();
  const hasDecision = !!row.decommission_commercial_id;

  // État local
  const [decommission, setDecommission] = useState<boolean>(hasDecision);
  const [commercialId, setCommercialId] = useState<string>(
    row.decommission_commercial_id || row.original_commercial_id || "",
  );
  const [amount, setAmount] = useState<string>(
    row.decommission_amount_eur !== null && row.decommission_amount_eur !== undefined
      ? String(Math.round(Number(row.decommission_amount_eur)))
      : "",
  );
  const [reason, setReason] = useState<string>(row.decommission_reason || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refundAmount = Math.abs(row.amount_net_eur);

  // Raccourcis pour les taux usuels (3 % / 5 % / 10 %)
  const rateShortcuts = [3, 5, 10];

  const apply = async () => {
    setErr(null);
    if (decommission) {
      if (!commercialId) {
        setErr("Choisis un négo à décommissionner");
        return;
      }
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        setErr("Montant à retenir requis (> 0)");
        return;
      }
      if (reason.trim().length < 5) {
        setErr("Motif obligatoire (5 caractères min)");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(
          `/api/sales/decommission/${encodeURIComponent(row.charge_id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              commercial_id: commercialId,
              amount_eur: amt,
              reason: reason.trim(),
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || `Erreur ${res.status}`);
          setBusy(false);
          return;
        }
        onClose();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setBusy(false);
      }
    } else {
      // Action "Non, la boîte assume" → DELETE pour retirer toute décision
      setBusy(true);
      try {
        const res = await fetch(
          `/api/sales/decommission/${encodeURIComponent(row.charge_id)}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || `Erreur ${res.status}`);
          setBusy(false);
          return;
        }
        onClose();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0A3855]">
              Décider du décommissionnement
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Refund de <strong>{fmtEur(refundAmount)}</strong> ·{" "}
              {row.email.replace(/^\(refund\)\s*/, "")}
            </p>
            {row.original_commercial_name && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Vente d&apos;origine attribuée à{" "}
                <strong>{row.original_commercial_name}</strong>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {hasDecision && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
            <strong>Décision actuelle :</strong>{" "}
            décommissionnement de{" "}
            <strong>
              {commercials.find((c) => c.id === row.decommission_commercial_id)
                ?.name || "?"}
            </strong>{" "}
            de <strong>{fmtEur(row.decommission_amount_eur)}</strong>
            <div className="text-[10px] text-gray-500 mt-1">
              Décidé par {row.decommission_set_by_email} le{" "}
              {row.decommission_set_at?.slice(0, 10)}
              {row.decommission_reason && (
                <span> — {row.decommission_reason}</span>
              )}
            </div>
          </div>
        )}

        {/* Toggle oui/non */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Décommissionner un négo pour ce refund ?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecommission(false)}
              className={`flex-1 px-3 py-2 rounded text-sm border transition ${
                !decommission
                  ? "bg-[#0A3855] text-white border-[#0A3855]"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              Non — la boîte assume
            </button>
            <button
              type="button"
              onClick={() => setDecommission(true)}
              className={`flex-1 px-3 py-2 rounded text-sm border transition ${
                decommission
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              Oui — retenir sur paie
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            {decommission
              ? "Le CA affiché du négo ne baisse pas. Le montant saisi sera retenu sur sa prochaine paie commission."
              : "Aucun négo n'est impacté. Seul le CA équipe est diminué par le refund."}
          </p>
        </div>

        {decommission && (
          <>
            {/* Dropdown négo */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Négo à décommissionner
              </label>
              <select
                value={commercialId}
                onChange={(e) => setCommercialId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                disabled={busy}
              >
                <option value="">— Sélectionner —</option>
                {commercials
                  .filter((c) => c.role !== "system_none")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.id === row.original_commercial_id ? " (vente d'origine)" : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* Montant à retenir */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Montant à retenir sur sa paie (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="Ex : 8.07"
                disabled={busy}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-gray-500">
                  Raccourcis taux × {fmtEur(refundAmount)} :
                </span>
                {rateShortcuts.map((rate) => {
                  const amt = (refundAmount * rate) / 100;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setAmount(amt.toFixed(2))}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                    >
                      {rate}% = {fmtEur(amt)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Calcul à la main car le taux historique du négo (3 %, 5 % ou 10 %
                selon l&apos;atteinte d&apos;objectif à l&apos;époque) n&apos;est
                pas tracké en base.
              </p>
            </div>

            {/* Motif */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Motif (obligatoire, audit)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="Ex : Driss était à 3% en avril (obj pas atteint) — 269 × 3% = 8.07€"
                disabled={busy}
              />
            </div>
          </>
        )}

        {err && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900"
          >
            Annuler
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className={`text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5 ${
              decommission
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-[#0A3855] hover:bg-[#0d4f78]"
            } disabled:opacity-50`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {decommission
              ? hasDecision
                ? "Mettre à jour la décision"
                : "Appliquer la décision"
              : hasDecision
                ? "Retirer la décision"
                : "Confirmer (la boîte assume)"}
          </button>
        </div>
      </div>
    </div>
  );
}
