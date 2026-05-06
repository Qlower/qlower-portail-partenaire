"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";

interface Props {
  yearMonth: string;
  isLocked: boolean;
}

export default function LockMonthButton({ yearMonth, isLocked }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  async function toggle(lock: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/sales/lock-month/${encodeURIComponent(yearMonth)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock, reason: lock ? null : reason || null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      setShowReason(false);
      setReason("");
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  if (isLocked) {
    if (showReason) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison (ex: erreur paie)"
            className="text-xs px-2 py-1 border border-gray-200 rounded"
            autoFocus
          />
          <button
            disabled={busy || !reason.trim()}
            onClick={() => toggle(false)}
            className="flex items-center gap-1 text-xs px-3 py-1 bg-amber-500 text-white rounded disabled:opacity-50"
          >
            <Unlock className="w-3 h-3" />
            Rouvrir
          </button>
          <button
            onClick={() => { setShowReason(false); setReason(""); }}
            className="text-xs text-gray-500"
          >
            Annuler
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setShowReason(true)}
        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 border border-gray-200 rounded hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"
        title="Le mois est clôturé. Cliquer pour le rouvrir."
      >
        <Lock className="w-3 h-3" />
        Mois clôturé
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        if (confirm(`Clôturer le mois ${yearMonth} ? Aucune édition ne sera plus possible jusqu'à réouverture.`)) {
          toggle(true);
        }
      }}
      disabled={busy}
      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
    >
      <Lock className="w-3 h-3" />
      Clôturer le mois
    </button>
  );
}
