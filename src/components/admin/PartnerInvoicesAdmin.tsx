"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, FileText, Download, Mail, AlertCircle, Eye, Upload, Banknote } from "lucide-react";

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
  commissionHt?: boolean;
  /** Si fourni, on n'affiche QUE cette année (sinon toutes les années éligibles) */
  focusYear?: number | null;
}

export default function PartnerInvoicesAdmin({ partnerId, partnerName, partnerEmail, commissionHt, focusYear }: Props) {
  const qc = useQueryClient();
  const [confirmSend, setConfirmSend] = useState<{ year: number; amount: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Preload preview when modal opens
  const loadPreview = async (year: number) => {
    setLoadingPreview(true);
    setPreviewHtml(null);
    try {
      const res = await fetch(
        `/api/admin/invoice-call-preview?partner_id=${partnerId}&year=${year}`
      );
      if (!res.ok) throw new Error("Preview unavailable");
      const data = await res.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch {
      setPreviewHtml("<p style='color:red'>Impossible de charger l'aperçu.</p>");
    } finally {
      setLoadingPreview(false);
    }
  };

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

  // Real commission amount per eligible year (for placeholders without uploaded invoice)
  const yearsKey = Array.from(eligibleYears).sort().join(",");
  const { data: commissionsByYear = {} } = useQuery<Record<number, number>>({
    queryKey: ["admin-partner-commissions-by-year", partnerId, yearsKey],
    queryFn: async () => {
      const years = Array.from(eligibleYears);
      const results = await Promise.all(
        years.map(async (y) => {
          const r = await fetch(`/api/partner/commissions?partner_id=${partnerId}&year=${y}`);
          if (!r.ok) return [y, 0] as const;
          const d = await r.json();
          return [y, Number(d.totalCommission ?? 0)] as const;
        })
      );
      return Object.fromEntries(results);
    },
    enabled: eligibleYears.size > 0,
  });

  // Active commission rules for the "Mode de calcul" block
  type RuleDetail = { label: string; montant: number; type: "one_shot" | "recurring" };
  const { data: ruleDetails = [] } = useQuery<RuleDetail[]>({
    queryKey: ["admin-partner-rules", partnerId],
    queryFn: async () => {
      const res = await fetch(`/api/partner/commissions?partner_id=${partnerId}&year=all`);
      if (!res.ok) return [];
      const d = await res.json();
      return (d.ruleDetails ?? []).filter((r: RuleDetail) => r.montant > 0);
    },
  });

  // Header action : choix de l'année pour envoyer l'appel
  const [headerYear, setHeaderYear] = useState<number | "">("");

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

  // Dépôt du PDF par l'admin à la place du partenaire (facture reçue hors portail,
  // ex. par email). Réutilise l'endpoint partenaire — qui préserve le statut payé.
  const [uploadingYear, setUploadingYear] = useState<number | null>(null);
  const uploadInvoiceFile = async (year: number, amount: number, file: File) => {
    if (file.type !== "application/pdf") {
      alert("Format PDF uniquement");
      return;
    }
    setUploadingYear(year);
    try {
      const fd = new FormData();
      fd.append("partner_id", partnerId);
      fd.append("year", String(year));
      fd.append("amount", String(amount > 0 ? amount : 0));
      fd.append("file", file);
      fd.append("via", "admin"); // dépôt admin → pas d'auto-notification
      const res = await fetch("/api/partner/invoices", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec de l'upload");
      }
      await qc.invalidateQueries({ queryKey: ["admin-partner-invoices", partnerId] });
      await qc.invalidateQueries({ queryKey: ["admin-all-invoices"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUploadingYear(null);
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
      await qc.invalidateQueries({ queryKey: ["admin-billing-overview"] });
    } catch (e) {
      console.error(e);
    }
  };

  // Saisie / modification MANUELLE du paiement (montant, payé o/n, date, note).
  // Fonctionne pour une facture existante (PATCH) comme pour une année sans
  // facture déposée (POST création — placeholder).
  const [payModal, setPayModal] = useState<{
    invoiceId: string | null;
    year: number;
    amount: number;
    isPaid: boolean;
    paidAt: string; // yyyy-mm-dd
    note: string;
  } | null>(null);
  const [savingPay, setSavingPay] = useState(false);

  const openPayModal = (inv: PartnerInvoice) => {
    setPayModal({
      invoiceId: inv.id.startsWith("placeholder-") ? null : inv.id,
      year: inv.year,
      amount: inv.amount || 0,
      isPaid: inv.is_paid,
      paidAt: inv.paid_at
        ? new Date(inv.paid_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      note: inv.notes || "",
    });
  };

  const savePayment = async () => {
    if (!payModal) return;
    setSavingPay(true);
    try {
      const paidAtIso = payModal.isPaid ? new Date(payModal.paidAt).toISOString() : null;
      const res = payModal.invoiceId
        ? await fetch("/api/admin/invoices", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: payModal.invoiceId,
              is_paid: payModal.isPaid,
              paid_at: paidAtIso,
              amount: payModal.amount,
              notes: payModal.note,
            }),
          })
        : await fetch("/api/admin/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partner_id: partnerId,
              year: payModal.year,
              amount: payModal.amount,
              is_paid: payModal.isPaid,
              paid_at: paidAtIso,
              notes: payModal.note,
            }),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }
      await qc.invalidateQueries({ queryKey: ["admin-partner-invoices", partnerId] });
      await qc.invalidateQueries({ queryKey: ["admin-all-invoices"] });
      await qc.invalidateQueries({ queryKey: ["admin-billing-overview"] });
      setPayModal(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingPay(false);
    }
  };

  // Crée une invoice "soldée hors facture" pour un placeholder year.
  // Utile quand le partenaire a déjà été payé en cash/virement et qu'on ne
  // veut pas l'embêter avec un appel à facture.
  const markPaidNoInvoice = async (year: number, amount: number) => {
    const note = window.prompt(
      `Marquer ${year} comme soldé hors facture (commission ${amount.toLocaleString("fr-FR")} €).\n\nMotif (optionnel, pour audit) :`,
      "Soldé hors facture",
    );
    if (note === null) return; // Cancelled
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          year,
          amount,
          is_paid: true,
          notes: note || "Soldé hors facture",
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Erreur création invoice");
      }
      await qc.invalidateQueries({ queryKey: ["admin-partner-invoices", partnerId] });
      await qc.invalidateQueries({ queryKey: ["admin-all-invoices"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
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
    if (focusYear != null && inv.year !== focusYear) continue;
    if (eligibleYears.size === 0 || eligibleYears.has(inv.year)) {
      rowsByYear.set(inv.year, inv);
    }
  }
  for (const y of eligibleYears) {
    if (focusYear != null && y !== focusYear) continue;
    if (!rowsByYear.has(y)) {
      rowsByYear.set(y, {
        id: `placeholder-${y}`,
        partner_id: partnerId,
        year: y,
        amount: commissionsByYear[y] ?? 0,
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

  // (displayRows.length === 0 géré par le render pour garder le header actions)

  const sortedEligibleYears = Array.from(eligibleYears).sort((a, b) => b - a);

  return (
    <>
    {/* En-tête actions : mode de calcul, impersonate, envoyer appel avec dropdown */}
    <div className="mb-3 bg-[#E5EDF1]/30 border border-gray-100 rounded-lg p-3 space-y-2">
      {ruleDetails.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
            Mode de calcul configuré
          </p>
          <div className="space-y-0.5">
            {ruleDetails.map((r, i) => (
              <p key={i} className="text-[11px] text-gray-700 leading-relaxed">
                <span className="font-semibold">{r.label}</span> : {r.montant}&nbsp;€&nbsp;{commissionHt ? "HT" : "TTC"}
                {r.type === "recurring"
                  ? " par abonné actif, chaque année"
                  : " par nouvel abonné (année de souscription)"}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => window.open(`/dashboard?as=${partnerId}`, "_blank")}
          title="Voir l'espace comme le partenaire"
        >
          <Eye className="size-3 mr-1" />
          Voir comme partenaire
        </Button>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-gray-500">Envoyer l&apos;appel pour :</span>
          <select
            value={headerYear === "" ? "" : String(headerYear)}
            onChange={(e) => setHeaderYear(e.target.value ? Number(e.target.value) : "")}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#F6CCA4]"
          >
            <option value="">Choisir une année…</option>
            {sortedEligibleYears
              .filter((y) => (commissionsByYear[y] ?? 0) > 0)
              .map((y) => (
                <option key={y} value={y}>
                  {y} — {(commissionsByYear[y] ?? 0).toLocaleString("fr-FR")} €
                </option>
              ))}
          </select>
          <Button
            size="sm"
            className="h-7 text-xs bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
            disabled={!headerYear || !partnerEmail}
            onClick={() => {
              if (!headerYear) return;
              const amount = commissionsByYear[headerYear] ?? 0;
              setConfirmSend({ year: headerYear, amount });
              loadPreview(headerYear);
            }}
            title={!partnerEmail ? "Aucun email renseigné" : "Envoyer l'appel"}
          >
            <Mail className="size-3 mr-1" />
            Envoyer l&apos;appel
          </Button>
        </div>
      </div>
    </div>

    {displayRows.length === 0 ? (
      <p className="text-xs text-gray-400 text-center py-3 border border-gray-100 rounded-lg">
        Aucune année éligible (contrat non renseigné ou pas d&apos;activité)
      </p>
    ) : (
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
                {inv.amount > 0 ? (
                  <div className="flex flex-col leading-tight">
                    <span>{inv.amount.toLocaleString("fr-FR")}&nbsp;€&nbsp;{commissionHt ? "HT" : "TTC"}</span>
                    {inv.id.startsWith("placeholder-") && (
                      <span className="text-[9px] text-gray-400 italic">Commission due</span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
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
                  {!inv.file_url && !inv.historical && !inv.is_paid && partnerEmail && inv.amount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setConfirmSend({ year: inv.year, amount: inv.amount });
                        loadPreview(inv.year);
                      }}
                      title={`Envoyer l'appel à facturation ${inv.year} par email`}
                    >
                      <Mail className="size-3 mr-0.5" />
                      Envoyer appel
                    </Button>
                  )}
                  {/* Déposer le PDF à la place du partenaire (facture reçue hors portail) */}
                  {!inv.file_url && !inv.historical && inv.amount > 0 && (
                    <label
                      className="h-6 text-[10px] px-2 inline-flex items-center gap-0.5 border border-gray-200 rounded cursor-pointer hover:bg-gray-50 text-gray-600"
                      title="Déposer le PDF de la facture à la place du partenaire"
                    >
                      {uploadingYear === inv.year ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Upload className="size-3" />
                      )}
                      PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={uploadingYear !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadInvoiceFile(inv.year, inv.amount, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {/* Soldé hors facture : pour placeholder year uniquement (pas de
                      facture déposée), permet de marquer comme déjà payé sans appel.
                      Utile pour commissions versées en cash / virement direct. */}
                  {inv.id.startsWith("placeholder-") && inv.amount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                      onClick={() => markPaidNoInvoice(inv.year, inv.amount)}
                      title="Marquer comme soldé hors facture (commission versée en cash/virement direct, n'envoie pas d'appel)"
                    >
                      <Check className="size-3 mr-0.5" />
                      Soldé hors facture
                    </Button>
                  )}
                  {!inv.historical && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-[#0A3855]/20 text-[#0A3855] hover:bg-[#E5EDF1]/40"
                      onClick={() => openPayModal(inv)}
                      title="Saisir / modifier le paiement manuellement (montant, date, note)"
                    >
                      <Banknote className="size-3 mr-0.5" />
                      Paiement
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
    )}

    {/* Modale de confirmation d'envoi avec preview email */}
    {confirmSend && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => !sending && setConfirmSend(null)}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col p-6 gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 flex-shrink-0">
            <div className="bg-[#FFF6EC] p-2 rounded-full">
              <Mail className="size-5 text-[#B8864E]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Envoyer l&apos;appel à facturation ?
              </h3>
              <div className="mt-2 bg-gray-50 rounded-md p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block">Partenaire</span>
                  <span className="font-semibold text-gray-900">{partnerName ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Destinataire</span>
                  <span className="font-mono text-[11px] text-gray-700 break-all">{partnerEmail}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Année</span>
                  <span className="font-semibold text-gray-900">{confirmSend.year}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Commission calculée</span>
                  <span className="font-bold text-[#0A3855]">
                    {confirmSend.amount.toLocaleString("fr-FR")}&nbsp;€&nbsp;{commissionHt ? "HT" : "TTC"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview de l'email */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span>Aperçu de l&apos;email qui sera envoyé</span>
              {previewSubject && (
                <span className="font-mono text-gray-400">Objet : {previewSubject}</span>
              )}
            </div>
            <div className="flex-1 border border-gray-200 rounded-lg overflow-auto bg-gray-50">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="size-4 animate-spin text-[#0A3855]" />
                </div>
              ) : previewHtml ? (
                <div
                  className="bg-white m-3 rounded shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400">
                  Aperçu indisponible
                </div>
              )}
            </div>
          </div>

          {sendResult && (
            <div className="flex items-start gap-1.5 text-xs flex-shrink-0">
              <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" />
              <span>{sendResult}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t flex-shrink-0">
            <Button variant="ghost" onClick={() => setConfirmSend(null)} disabled={sending}>
              Annuler
            </Button>
            <Button
              className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
              onClick={handleSendCall}
              disabled={sending || !partnerEmail || confirmSend.amount <= 0}
              title={confirmSend.amount <= 0 ? "Aucune commission due pour cette année" : "Envoyer l'email"}
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

    {/* Modale paiement manuel (saisie / modification) */}
    {payModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => !savingPay && setPayModal(null)}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Paiement {payModal.year}
              </h3>
              <p className="text-[11px] text-gray-400">{partnerName ?? ""}</p>
            </div>
            <button
              onClick={() => !savingPay && setPayModal(null)}
              className="text-gray-400 hover:text-gray-600"
              disabled={savingPay}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Montant ({commissionHt ? "HT" : "TTC"}, €)
              </label>
              <input
                type="number"
                step="0.01"
                value={payModal.amount}
                onChange={(e) => setPayModal({ ...payModal, amount: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={payModal.isPaid}
                onChange={(e) => setPayModal({ ...payModal, isPaid: e.target.checked })}
              />
              Marquée payée
            </label>
            {payModal.isPaid && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Date de paiement</label>
                <input
                  type="date"
                  value={payModal.paidAt}
                  onChange={(e) => setPayModal({ ...payModal, paidAt: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Note (optionnel)</label>
              <input
                type="text"
                value={payModal.note}
                onChange={(e) => setPayModal({ ...payModal, note: e.target.value })}
                placeholder="ex. virement reçu, acompte, règlement direct…"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => setPayModal(null)} disabled={savingPay}>
              Annuler
            </Button>
            <Button
              className="bg-[#0A3855] text-white hover:bg-[#0A3855]/90"
              onClick={savePayment}
              disabled={savingPay || payModal.amount <= 0}
            >
              {savingPay ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
