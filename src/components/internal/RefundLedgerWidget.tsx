"use client";

// Widget "Refunds décomptés ce mois" — affiche le total et la liste des lignes
// négatives de type stripe_refund_ledger / manual_refund_ledger sur le mois
// courant. Permet à l'admin de visualiser combien de CA a été "annulé" par
// des refunds de ventes passées (ledger-style accounting).

import { useState } from "react";
import { ChevronDown, ChevronUp, Undo2 } from "lucide-react";

export interface LedgerEntry {
  charge_id: string;
  email: string;
  amount_net_eur: number; // négatif
  created_at: string;
  effective_commercial_name: string | null;
  auto_source: string | null;
  description: string | null;
}

interface Props {
  entries: LedgerEntry[];
}

const fmtEur = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR", { signDisplay: "auto" })} €`;

export default function RefundLedgerWidget({ entries }: Props) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + (e.amount_net_eur || 0), 0);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-amber-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <Undo2 className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-[#0A3855]">
            <strong>{entries.length}</strong> refund{entries.length > 1 ? "s" : ""} décompté{entries.length > 1 ? "s" : ""} sur ce mois ·{" "}
            <strong className="text-amber-700">{fmtEur(total)}</strong> retirés du CA
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-200 px-4 py-3 space-y-1.5">
          <p className="text-xs text-gray-600 mb-2">
            Ces lignes négatives correspondent à des refunds Stripe sur des ventes des mois
            précédents. Le montant est retiré du CA du mois courant et impacte automatiquement
            l&apos;atteinte d&apos;objectif du négo attribué.
          </p>
          {entries.map((e) => (
            <div
              key={e.charge_id}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs py-1.5 border-b border-amber-100 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-[#0A3855] truncate">
                  {e.email.replace(/^\(refund\)\s*/, "")}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {e.description || "—"}
                </div>
              </div>
              <span className="text-gray-600 whitespace-nowrap">
                {e.effective_commercial_name || "—"}
              </span>
              <span className="font-semibold text-amber-700 whitespace-nowrap">
                {fmtEur(e.amount_net_eur)}
              </span>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 pt-1">
            Source : webhook Stripe charge.refunded (auto) ou saisie admin (manuel).
          </p>
        </div>
      )}
    </div>
  );
}
