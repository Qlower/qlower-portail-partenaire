"use client";

// Bouton + modal : "Acter un refund passé"
//
// Permet à l'admin de créer une ligne ledger NÉGATIVE dans le mois courant
// pour un refund effectué AVANT le déploiement du auto-ledger Stripe (ou
// pour un cas qui n'aurait pas été capté par le webhook).
//
// Usage typique : le refund de ce matin d'une vente passée — pas encore
// décompté du CA du mois courant. L'admin saisit le charge_id Stripe + le
// montant et la ligne apparaît dans le widget RefundLedgerWidget.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2, X } from "lucide-react";

export default function ManualRefundLedgerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chargeId, setChargeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!chargeId.trim()) {
      setErr("charge_id Stripe requis (ex: ch_3RxxxXxXxXxXxXxX)");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErr("Montant > 0 requis (€, sans signe)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/sales/refund-ledger/${encodeURIComponent(chargeId.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, reason: reason.trim() || undefined }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Erreur ${res.status}`);
        setBusy(false);
        return;
      }
      setOpen(false);
      setChargeId("");
      setAmount("");
      setReason("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition flex items-center gap-1.5"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Acter un refund passé
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-[#0A3855]">
                Acter un refund passé
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Crée une ligne négative dans le mois courant pour décompter un refund
              Stripe d&apos;une vente passée. À utiliser pour les refunds effectués
              avant l&apos;activation du décompte automatique, ou en rattrapage.
            </p>

            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-700">charge_id Stripe</span>
                <input
                  type="text"
                  value={chargeId}
                  onChange={(e) => setChargeId(e.target.value)}
                  placeholder="ch_3RxxxxxxxxxxxxxxX"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                  disabled={busy}
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-700">Montant à décompter (€)</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="269"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  disabled={busy}
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-700">
                  Motif (optionnel mais recommandé)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ex : refund accordé suite à erreur Qlower / client insatisfait..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  disabled={busy}
                />
              </label>
            </div>

            {err && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {err}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="text-xs px-3 py-1.5 bg-[#0A3855] text-white rounded hover:bg-[#0a3855]/90 flex items-center gap-1.5"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Acter le refund
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
