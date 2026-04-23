"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Download, FileText, Check, AlertCircle, X } from "lucide-react";

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

export default function PartnerInvoicesSection({ partnerId }: Props) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const defaultInvoiceYear = currentYear - 1; // N-1 par défaut

  const { data: invoices = [], isLoading } = useQuery<PartnerInvoice[]>({
    queryKey: ["partner-invoices", partnerId],
    queryFn: async () => {
      const res = await fetch(`/api/partner/invoices?partner_id=${partnerId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!partnerId,
  });

  // Commission computed for the default year (for pre-filling the amount)
  const { data: commData } = useQuery<{ totalCommission?: number }>({
    queryKey: ["commissions-for-invoice", partnerId, defaultInvoiceYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/partner/commissions?partner_id=${partnerId}&year=${defaultInvoiceYear}`
      );
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!partnerId,
  });
  const commissionDue = Math.round(commData?.totalCommission ?? 0);

  const existingForDefault = invoices.find((i) => i.year === defaultInvoiceYear);
  const hasInvoiceForDefault = !!existingForDefault?.file_url;

  const [showModal, setShowModal] = useState(false);
  const [modalYear, setModalYear] = useState(defaultInvoiceYear);
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const openModal = (year?: number) => {
    const y = year ?? defaultInvoiceYear;
    setModalYear(y);
    const existing = invoices.find((i) => i.year === y);
    setModalAmount(existing?.amount && existing.amount > 0 ? existing.amount : commissionDue);
    setModalFile(null);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const submitInvoice = async () => {
    setError("");
    if (!modalFile) {
      setError("Merci de joindre votre facture au format PDF");
      return;
    }
    if (modalAmount <= 0) {
      setError("Le montant doit être supérieur à 0");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("partner_id", partnerId);
      fd.append("year", String(modalYear));
      fd.append("amount", String(modalAmount));
      fd.append("file", modalFile);
      const res = await fetch("/api/partner/invoices", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur lors du dépôt de la facture");
      }
      setSuccess("Facture déposée avec succès — elle est maintenant en attente de paiement");
      await queryClient.invalidateQueries({ queryKey: ["partner-invoices", partnerId] });
      setTimeout(() => setShowModal(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUploading(false);
    }
  };

  // Visible invoices: merge DB + "à facturer" placeholder for N-1 if none exists yet
  const displayRows = useMemo(() => {
    const map = new Map<number, PartnerInvoice>();
    for (const inv of invoices) map.set(inv.year, inv);
    // Add placeholder for N-1 if nothing exists yet
    if (!map.has(defaultInvoiceYear)) {
      map.set(defaultInvoiceYear, {
        id: `placeholder-${defaultInvoiceYear}`,
        partner_id: partnerId,
        year: defaultInvoiceYear,
        amount: commissionDue,
        file_url: null,
        uploaded_at: null,
        is_paid: false,
        paid_at: null,
        historical: false,
        notes: null,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [invoices, defaultInvoiceYear, partnerId, commissionDue]);

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm font-semibold text-gray-900">
            Mes factures à Qlower
          </CardTitle>
          {!hasInvoiceForDefault && commissionDue > 0 && (
            <Button
              onClick={() => openModal(defaultInvoiceYear)}
              className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
            >
              <Plus className="size-4 mr-1.5" />
              Appel à facturation {defaultInvoiceYear}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 text-[#0A3855] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Année</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Montant</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Facture</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Date dépôt</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Paiement</th>
                  <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayRows.map((inv) => {
                  const isPlaceholder = inv.id.startsWith("placeholder-");
                  const needsUpload = !inv.file_url && !inv.historical;
                  return (
                    <tr key={inv.id} className="hover:bg-[#E5EDF1]/20 transition-colors">
                      <td className="py-3.5 font-semibold text-gray-900">{inv.year}</td>
                      <td className="py-3.5 tabular-nums text-gray-700">
                        {inv.amount > 0 ? `${inv.amount.toLocaleString("fr-FR")} €` : "—"}
                      </td>
                      <td className="py-3.5">
                        {inv.file_url ? (
                          <a
                            href={`/api/partner/invoices/${inv.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0A3855] hover:underline text-xs"
                          >
                            <FileText className="size-3.5" />
                            Voir PDF
                          </a>
                        ) : inv.historical ? (
                          <span className="text-xs text-gray-400">Historique pré-portail</span>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 shadow-none text-[10px]">
                            En attente de dépôt
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 text-xs text-gray-500">
                        {inv.uploaded_at
                          ? new Date(inv.uploaded_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-3.5">
                        {inv.is_paid ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none text-[10px]">
                            <Check className="size-3 mr-0.5 inline" />
                            Payée {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("fr-FR") : ""}
                          </Badge>
                        ) : inv.historical ? (
                          <Badge className="bg-gray-50 text-gray-500 border border-gray-200 shadow-none text-[10px]">
                            Déjà réglé
                          </Badge>
                        ) : inv.file_url ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 shadow-none text-[10px]">
                            En attente
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex gap-2 justify-end">
                          {!isPlaceholder && !inv.historical && (
                            <a
                              href={`/api/partner/invoice-call?partner_id=${partnerId}&year=${inv.year}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-[#0A3855] inline-flex items-center gap-1"
                              title="Télécharger le récapitulatif de commission"
                            >
                              <Download className="size-3.5" />
                              Récap
                            </a>
                          )}
                          {needsUpload && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => openModal(inv.year)}
                            >
                              <Plus className="size-3 mr-0.5" />
                              Déposer
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de dépôt */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !uploading && setShowModal(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Déposer ma facture pour {modalYear}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Commission due : <strong>{commissionDue.toLocaleString("fr-FR")} €</strong>
                  </p>
                </div>
                <button
                  onClick={() => !uploading && setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={uploading}
                >
                  <X className="size-4" />
                </button>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="size-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800">
                  Téléchargez d&apos;abord le récapitulatif de commission pour créer votre
                  facture avec votre SIRET et vos mentions légales.
                  <a
                    href={`/api/partner/invoice-call?partner_id=${partnerId}&year=${modalYear}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline ml-1 font-semibold"
                  >
                    Télécharger le récap
                  </a>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Année concernée</Label>
                  <Input
                    type="number"
                    value={modalYear}
                    onChange={(e) => setModalYear(parseInt(e.target.value) || modalYear)}
                    min={2024}
                    max={currentYear}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Montant TTC (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-gray-400">
                    Pré-rempli avec le montant calculé. Ajustez si votre facture diffère.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Votre facture PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setModalFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-[10px] text-gray-400">
                    Format PDF uniquement, 10 Mo max.
                  </p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-emerald-50 border-emerald-200">
                  <Check className="size-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button variant="ghost" onClick={() => setShowModal(false)} disabled={uploading}>
                  Annuler
                </Button>
                <Button
                  className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                  onClick={submitInvoice}
                  disabled={uploading || !modalFile || modalAmount <= 0}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-1.5" />
                      Déposer ma facture
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
