"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, FileText, Download, Mail, AlertCircle } from "lucide-react";

interface PartnerInvoice {
  id: string;
  partner_id: string;
  year: number;
  amount: number;
  file_url: string | null;
  uploaded_at: string | null;
  is_paid: boolean;
  paid_at: string | null;
  historical: boolean;
  notes: string | null;
}

interface Props {
  partnerId: string;
  partnerName?: string;
  partnerEmail?: string | null;
}

export default function PartnerInvoicesAdmin({ partnerId, partnerName, partnerEmail }: Props) {
  const qc = useQueryClient();
  const [confirmSend, setConfirmSend] = useState<{ year: number; amount: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery<PartnerInvoice[]>({
    queryKey: ["admin-partner-invoices", partnerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/invoices?partner_id=${partnerId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Eligible years for this partner (activity + contract signed)
  const { data: activeYears } = useQuery<{ years: number[]; contract_year: number | null }>({
    queryKey: ["admin-partner-active-years", partnerId],
    queryFn: async () => {
      const res = await fetch(`/api/partner/active-years?partner_id=${partnerId}`);
      if (!res.ok) return { years: [], contract_year: null };
      return res.json();
    },
  });
  const eligibleYears = new Set(activeYears?.years ?? []);

  const handleSendCall = async () => {
    if (!confirmSend) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/send-invoice-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: confirmSend.year, partner_ids: [partnerId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (data.sent > 0) {
        setSendResult("✅ Email envoyé !");
        setTimeout(() => setConfirmSend(null), 1500);
      } else {
        setSendResult(`⚠️ Email non envoyé (${data.details?.[0]?.status ?? "raison inconnue"})`);
      }
    } catch (e) {
      setSendResult(e instanceof Error ? `❌ ${e.message}` : "❌ Erreur");
    } finally {
      setSending(false);
    }
  };

  const togglePaid = async (invoice: PartnerInvoice) => {
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoice.id,
          is_paid: !invoice.is_paid,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      await qc.invalidateQueries({ queryKey: ["admin-partner-invoices", partnerId] });
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 text-[#0A3855] animate-spin" />
      </div>
    );
  }

  // Merge: invoices in DB + eligible years without invoice yet (placeholders)
  const rowsByYear = new Map<number, PartnerInvoice>();
  for (const inv of invoices) {
    if (eligibleYears.size === 0 || eligibleYears.has(inv.year)) {
      rowsByYear.set(inv.year, inv);
    }
  }
  for (const y of eligibleYears) {
    if (!rowsByYear.has(y)) {
      rowsByYear.set(y, {
        id: `placeholder-${y}`,
        partner_id: partnerId,
        year: y,
        amount: 0,
        file_url: null,
        uploaded_at: null,
        is_paid: false,
        paid_at: null,
        historical: false,
        notes: null,
      });
    }
  }
  const displayRows = Array.from(rowsByYear.values()).sort((a, b) => b.year - a.year);

  if (displayRows.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">
        Aucune année éligible (contrat non renseigné ou pas d&apos;activité)
      </p>
    );
  }

  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#E5EDF1]/40">
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Année</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Montant</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Facture</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Dépôt</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Statut</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {displayRows.map((inv) => (
            <tr key={inv.id} className="hover:bg-[#E5EDF1]/20">
              <td className="px-3 py-2 text-xs font-semibold text-gray-900">{inv.year}</td>
              <td className="px-3 py-2 text-xs tabular-nums">
                {inv.amount > 0 ? `${inv.amount.toLocaleString("fr-FR")}\u00a0€` : "—"}
              </td>
              <td className="px-3 py-2">
                {inv.file_url ? (
                  <a
                    href={`/api/partner/invoices/${inv.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#0A3855] hover:underline text-[11px]"
                  >
                    <FileText className="size-3" />
                    Voir PDF
                  </a>
                ) : inv.historical ? (
                  <span className="text-[10px] text-gray-400 italic">Historique</span>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] shadow-none">
                    Non déposée
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-[10px] text-gray-500">
                {inv.uploaded_at
                  ? new Date(inv.uploaded_at).toLocaleDateString("fr-FR")
                  : "—"}
              </td>
              <td className="px-3 py-2">
                {inv.is_paid ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] shadow-none">
                    <Check className="size-3 mr-0.5 inline" />
                    Payée
                    {inv.paid_at && (
                      <span className="ml-1 opacity-70">
                        {new Date(inv.paid_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </Badge>
                ) : inv.historical ? (
                  <Badge className="bg-gray-50 text-gray-500 border border-gray-200 text-[10px] shadow-none">
                    Déjà réglé
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] shadow-none">
                    En attente
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex gap-1 justify-end">
                  <a
                    href={`/api/partner/invoice-call?partner_id=${partnerId}&year=${inv.year}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-500 hover:text-[#0A3855] inline-flex items-center gap-0.5"
                    title="Télécharger le récap"
                  >
                    <Download className="size-3" />
                  </a>
                  {!inv.file_url && !inv.historical && partnerEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setConfirmSend({ year: inv.year, amount: inv.amount })}
                      title={`Envoyer l'appel à facturation ${inv.year} par email`}
                    >
                      <Mail className="size-3 mr-0.5" />
                      Envoyer appel
                    </Button>
                  )}
                  {!inv.historical && !inv.id.startsWith("placeholder-") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => togglePaid(inv)}
                      title={inv.is_paid ? "Marquer comme non payée" : "Marquer comme payée"}
                    >
                      {inv.is_paid ? (
                        <>
                          <X className="size-3 mr-0.5" />
                          Dépayer
                        </>
                      ) : (
                        <>
                          <Check className="size-3 mr-0.5" />
                          Marquer payée
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Modale de confirmation d'envoi */}
    {confirmSend && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => !sending && setConfirmSend(null)}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="bg-[#FFF6EC] p-2 rounded-full">
              <Mail className="size-5 text-[#B8864E]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Envoyer l&apos;appel à facturation ?
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Un email sera envoyé au partenaire avec le montant de commission dû
                et un lien pour déposer sa facture.
              </p>
              <div className="mt-3 bg-gray-50 rounded-md p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Partenaire</span>
                  <span className="font-semibold text-gray-900">{partnerName ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Destinataire</span>
                  <span className="font-mono text-[11px] text-gray-700">{partnerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Année</span>
                  <span className="font-semibold text-gray-900">{confirmSend.year}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-500">Commission calculée</span>
                  <span className="font-bold text-[#0A3855]">
                    {confirmSend.amount.toLocaleString("fr-FR")}&nbsp;€
                  </span>
                </div>
              </div>
              {sendResult && (
                <div className="mt-3 flex items-start gap-1.5 text-xs">
                  <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" />
                  <span>{sendResult}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => setConfirmSend(null)} disabled={sending}>
              Annuler
            </Button>
            <Button
              className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
              onClick={handleSendCall}
              disabled={sending || !partnerEmail}
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Mail className="size-4 mr-1.5" />
                  Confirmer &amp; envoyer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
