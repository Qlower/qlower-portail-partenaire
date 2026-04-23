"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, FileText, Download } from "lucide-react";

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
}

export default function PartnerInvoicesAdmin({ partnerId }: Props) {
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<PartnerInvoice[]>({
    queryKey: ["admin-partner-invoices", partnerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/invoices?partner_id=${partnerId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

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

  if (invoices.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">
        Aucune facture pour ce partenaire
      </p>
    );
  }

  return (
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
          {invoices.map((inv) => (
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
                  {!inv.historical && (
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
  );
}
