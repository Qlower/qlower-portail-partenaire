"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PartnerInvoicesAdmin from "./PartnerInvoicesAdmin";
import {
  Loader2,
  Receipt,
  Info,
  Search,
  CheckCircle2,
  Clock,
  Mail,
  FileText,
  X,
  AlertCircle,
  PiggyBank,
  Banknote,
  Check,
  Eye,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================
type Status =
  | "to_pay"
  | "waiting_invoice"
  | "not_called"
  | "paid"
  | "paid_no_invoice"
  | "historical"
  | "no_commission";

interface BillingRow {
  partner_id: string;
  partner_name: string;
  partner_email: string | null;
  partner_code: string;
  commission_ht: boolean;
  contract_signed_at: string | null;
  year: number;
  commission: number;
  subscribers: number;
  invoice: {
    id: string;
    file_url: string | null;
    is_paid: boolean;
    historical: boolean;
    uploaded_at: string | null;
    paid_at: string | null;
    amount: number;
    notes: string | null;
  } | null;
  status: Status;
}

// ============================================================================
// Status helpers
// ============================================================================
const STATUS_META: Record<
  Status,
  { label: string; short: string; bg: string; text: string; icon: typeof Mail; description: string }
> = {
  to_pay: {
    label: "À régler",
    short: "À régler",
    bg: "bg-amber-50",
    text: "text-amber-700 border-amber-200",
    icon: Banknote,
    description: "Facture reçue, en attente de règlement",
  },
  waiting_invoice: {
    label: "Attente facture",
    short: "Attente facture",
    bg: "bg-blue-50",
    text: "text-blue-700 border-blue-200",
    icon: FileText,
    description: "Appel envoyé, le partenaire n'a pas encore uploadé sa facture",
  },
  not_called: {
    label: "À appeler",
    short: "À appeler",
    bg: "bg-orange-50",
    text: "text-orange-700 border-orange-200",
    icon: Mail,
    description: "Commission due, aucun appel envoyé pour cette année",
  },
  paid: {
    label: "Réglé",
    short: "Réglé",
    bg: "bg-emerald-50",
    text: "text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    description: "Facture reçue et payée",
  },
  paid_no_invoice: {
    label: "Soldé hors facture",
    short: "Soldé h.f.",
    bg: "bg-violet-50",
    text: "text-violet-700 border-violet-200",
    icon: CheckCircle2,
    description: "Commission versée en cash/virement direct, pas de facture émise",
  },
  historical: {
    label: "Historique",
    short: "Historique",
    bg: "bg-gray-50",
    text: "text-gray-500 border-gray-200",
    icon: Clock,
    description: "Facture marquée comme déjà réglée hors système",
  },
  no_commission: {
    label: "Sans commission",
    short: "Sans commission",
    bg: "bg-gray-50",
    text: "text-gray-400 border-gray-100",
    icon: Info,
    description: "Aucune commission due pour cette année",
  },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge className={`${meta.bg} ${meta.text} border text-[10px] shadow-none whitespace-nowrap`}>
      <Icon className="size-3 mr-0.5" />
      {meta.short}
    </Badge>
  );
}

// ============================================================================
// Tab principal
// ============================================================================
export default function FacturationTab() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all" | "actionable">("actionable");
  // Liste d'IDs qu'on vient de modifier (animation de feedback)
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  // Détail partenaire (panneau latéral)
  const [detailPartner, setDetailPartner] = useState<{ id: string; name: string; email: string | null; commission_ht: boolean } | null>(null);
  // Envoi d'appel : on délègue à PartnerInvoicesAdmin via le panneau détail

  // ─── Data ───────────────────────────────────────────────────────────────
  const { data: overview, isLoading } = useQuery<{ rows: BillingRow[]; year: number }>({
    queryKey: ["admin-billing-overview", year],
    queryFn: async () => {
      const res = await fetch(`/api/admin/invoices/billing-overview?year=${year}`);
      if (!res.ok) return { rows: [], year };
      return res.json();
    },
    staleTime: 30_000,
  });
  const rows = useMemo(() => overview?.rows ?? [], [overview]);

  // Available years from existing invoices (pour le dropdown)
  const { data: allInvoices = [] } = useQuery<Array<{ year: number }>>({
    queryKey: ["admin-all-invoices-years"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invoices");
      if (!res.ok) return [];
      const j: Array<{ year: number }> = await res.json();
      return j;
    },
    staleTime: 60_000,
  });
  const availableYears = useMemo(() => {
    const years = new Set<number>(allInvoices.map((i) => i.year));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices, currentYear]);

  // ─── Compteurs par statut ──────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      to_pay: 0,
      waiting_invoice: 0,
      not_called: 0,
      paid: 0,
      paid_no_invoice: 0,
      historical: 0,
      no_commission: 0,
    };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  // Totaux financiers (pour les KPI cards)
  const totals = useMemo(() => {
    let due = 0;
    let toPay = 0;
    let paid = 0;
    for (const r of rows) {
      if (r.status === "no_commission" || r.status === "historical") continue;
      due += r.commission;
      if (r.status === "to_pay") toPay += r.invoice?.amount || r.commission;
      if (r.status === "paid" || r.status === "paid_no_invoice")
        paid += r.invoice?.amount || r.commission;
    }
    return { due, toPay, paid };
  }, [rows]);

  // ─── Filter ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // "actionable" : tout sauf paid / paid_no_invoice / historical / no_commission
      if (statusFilter === "actionable") {
        if (r.status === "paid" || r.status === "paid_no_invoice" || r.status === "historical" || r.status === "no_commission") return false;
      } else if (statusFilter !== "all") {
        if (r.status !== statusFilter) return false;
      } else {
        // "all" : on cache quand même les "no_commission" qui pollueraient la vue
        if (r.status === "no_commission") return false;
      }
      if (!q) return true;
      return (
        r.partner_name.toLowerCase().includes(q) ||
        (r.partner_email || "").toLowerCase().includes(q) ||
        r.partner_code.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  // ─── Actions inline ─────────────────────────────────────────────────────
  const flashUpdate = (key: string) => {
    setRecentlyUpdated((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setRecentlyUpdated((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1500);
  };

  // Toggle is_paid sur une invoice existante
  const togglePaid = async (row: BillingRow) => {
    if (!row.invoice) return;
    const desired = !row.invoice.is_paid;
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.invoice.id, is_paid: desired }),
      });
      if (!res.ok) throw new Error("update failed");
      flashUpdate(row.partner_id + "-" + row.year);
      await qc.invalidateQueries({ queryKey: ["admin-billing-overview", year] });
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise à jour");
    }
  };

  // Marquer soldé hors facture (crée invoice avec is_paid=true, sans file_url)
  const markPaidNoInvoice = async (row: BillingRow) => {
    const note = window.prompt(
      `Marquer ${row.year} comme soldé hors facture pour ${row.partner_name}\n(commission ${row.commission.toLocaleString("fr-FR")} €).\n\nMotif (optionnel, pour audit) :`,
      "Soldé hors facture",
    );
    if (note === null) return;
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: row.partner_id,
          year: row.year,
          amount: row.commission,
          is_paid: true,
          notes: note || "Soldé hors facture",
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Erreur création invoice");
      }
      flashUpdate(row.partner_id + "-" + row.year);
      await qc.invalidateQueries({ queryKey: ["admin-billing-overview", year] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  // Envoyer un appel à facturation (création placeholder + email)
  const [callingId, setCallingId] = useState<string | null>(null);
  const sendCall = async (row: BillingRow) => {
    if (!row.partner_email) {
      alert("Aucun email enregistré pour ce partenaire.");
      return;
    }
    if (!confirm(`Envoyer l'appel à facturation ${row.year} à ${row.partner_email} ?\nMontant : ${row.commission.toLocaleString("fr-FR")} € ${row.commission_ht ? "HT" : "TTC"}`)) {
      return;
    }
    setCallingId(row.partner_id + "-" + row.year);
    try {
      const res = await fetch("/api/admin/send-invoice-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: row.year, partner_ids: [row.partner_id] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erreur");
      if (j.sent > 0) {
        flashUpdate(row.partner_id + "-" + row.year);
      } else {
        alert(`Email non envoyé : ${j.details?.[0]?.status ?? "raison inconnue"}`);
      }
      await qc.invalidateQueries({ queryKey: ["admin-billing-overview", year] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCallingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement de la facturation…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ============ KPI Cards CLICKABLES ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Commissions dues (total) */}
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-left transition-transform hover:scale-[1.01] ${
            statusFilter === "all" ? "ring-2 ring-[#0A3855] rounded-lg" : ""
          }`}
        >
          <Card className="bg-[#0A3855] text-white border-none h-full">
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Receipt className="size-5 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
                    Commissions {year}
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {Math.round(totals.due).toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Cliquer pour tout afficher
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* À régler */}
        <button
          onClick={() => setStatusFilter("to_pay")}
          className={`text-left transition-transform hover:scale-[1.01] ${
            statusFilter === "to_pay" ? "ring-2 ring-amber-400 rounded-lg" : ""
          }`}
        >
          <Card className="h-full">
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Banknote className="size-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                    À régler
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                    {Math.round(totals.toPay).toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {counts.to_pay} facture{counts.to_pay > 1 ? "s" : ""} reçue{counts.to_pay > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Réglé */}
        <button
          onClick={() => setStatusFilter("paid")}
          className={`text-left transition-transform hover:scale-[1.01] ${
            statusFilter === "paid" ? "ring-2 ring-emerald-400 rounded-lg" : ""
          }`}
        >
          <Card className="h-full">
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <PiggyBank className="size-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                    Réglé
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                    {Math.round(totals.paid).toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {counts.paid + counts.paid_no_invoice} règlement{counts.paid + counts.paid_no_invoice > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* ============ Filtres ============ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
              placeholder="Rechercher partenaire / email / code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              Année :
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white hover:border-gray-300 font-medium text-[#0A3855]"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterPill
            active={statusFilter === "actionable"}
            label="🎯 Actions à mener"
            count={counts.to_pay + counts.waiting_invoice + counts.not_called}
            onClick={() => setStatusFilter("actionable")}
            tone="navy"
          />
          <FilterPill
            active={statusFilter === "all"}
            label="Toutes"
            count={rows.length - counts.no_commission}
            onClick={() => setStatusFilter("all")}
          />
          <span className="mx-1 text-gray-200">|</span>
          <FilterPill
            active={statusFilter === "to_pay"}
            label={STATUS_META.to_pay.label}
            count={counts.to_pay}
            onClick={() => setStatusFilter("to_pay")}
            tone="amber"
          />
          <FilterPill
            active={statusFilter === "waiting_invoice"}
            label={STATUS_META.waiting_invoice.label}
            count={counts.waiting_invoice}
            onClick={() => setStatusFilter("waiting_invoice")}
            tone="blue"
          />
          <FilterPill
            active={statusFilter === "not_called"}
            label={STATUS_META.not_called.label}
            count={counts.not_called}
            onClick={() => setStatusFilter("not_called")}
            tone="orange"
          />
          <span className="mx-1 text-gray-200">|</span>
          <FilterPill
            active={statusFilter === "paid"}
            label={STATUS_META.paid.label}
            count={counts.paid}
            onClick={() => setStatusFilter("paid")}
            tone="emerald"
          />
          <FilterPill
            active={statusFilter === "paid_no_invoice"}
            label={STATUS_META.paid_no_invoice.label}
            count={counts.paid_no_invoice}
            onClick={() => setStatusFilter("paid_no_invoice")}
            tone="violet"
          />
        </div>
      </div>

      {/* ============ Table ============ */}
      {filtered.length === 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Aucun partenaire ne correspond à ces filtres.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#E5EDF1]/40 border-b border-gray-100">
                  <tr>
                    <Th>Partenaire</Th>
                    <Th>Commission</Th>
                    <Th>Statut</Th>
                    <Th>Détail facture</Th>
                    <Th className="text-right pr-3">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row) => {
                    const key = row.partner_id + "-" + row.year;
                    const flashing = recentlyUpdated.has(key);
                    return (
                      <tr
                        key={key}
                        className={`transition-colors ${
                          flashing ? "bg-emerald-50/60" : "hover:bg-[#E5EDF1]/15"
                        }`}
                      >
                        {/* Partenaire */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold text-gray-900">{row.partner_name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {row.partner_code}
                              {row.partner_email && (
                                <>
                                  <span className="mx-1">·</span>
                                  {row.partner_email}
                                </>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Commission */}
                        <td className="px-3 py-2.5 tabular-nums">
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold text-[#0A3855]">
                              {Math.round(row.commission).toLocaleString("fr-FR")} €{" "}
                              <span className="text-[10px] font-normal text-gray-400">
                                {row.commission_ht ? "HT" : "TTC"}
                              </span>
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {row.subscribers} abonné{row.subscribers > 1 ? "s" : ""}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>

                        {/* Détail facture */}
                        <td className="px-3 py-2.5">
                          {row.invoice ? (
                            <div className="flex flex-col gap-0.5 text-[10px] text-gray-500">
                              {row.invoice.file_url ? (
                                <a
                                  href={`/api/partner/invoices/${row.invoice.id}/file`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#0A3855] hover:underline text-[11px]"
                                  title="Ouvrir la facture"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText className="size-3" />
                                  Voir PDF
                                </a>
                              ) : (
                                <span className="italic text-gray-400">Pas de PDF</span>
                              )}
                              {row.invoice.uploaded_at && (
                                <span>Reçue le {new Date(row.invoice.uploaded_at).toLocaleDateString("fr-FR")}</span>
                              )}
                              {row.invoice.paid_at && (
                                <span>Payée le {new Date(row.invoice.paid_at).toLocaleDateString("fr-FR")}</span>
                              )}
                              {row.invoice.notes && (
                                <span className="italic text-violet-600">{row.invoice.notes}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1 justify-end">
                            {/* Action principale dépend du statut */}
                            {row.status === "to_pay" && (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => togglePaid(row)}
                                title="Marquer la facture comme payée"
                              >
                                <Check className="size-3 mr-0.5" />
                                Marquer payée
                              </Button>
                            )}
                            {row.status === "waiting_invoice" && row.partner_email && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                disabled={callingId === key}
                                onClick={() => sendCall(row)}
                                title="Renvoyer un email de rappel"
                              >
                                {callingId === key ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="size-3 mr-0.5" />
                                    Relancer
                                  </>
                                )}
                              </Button>
                            )}
                            {row.status === "not_called" && row.partner_email && (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                                disabled={callingId === key}
                                onClick={() => sendCall(row)}
                                title="Envoyer l'appel à facturation par email"
                              >
                                {callingId === key ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="size-3 mr-0.5" />
                                    Envoyer appel
                                  </>
                                )}
                              </Button>
                            )}
                            {row.status === "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => togglePaid(row)}
                                title="Annuler le statut payé"
                              >
                                <X className="size-3 mr-0.5" />
                                Dépayer
                              </Button>
                            )}
                            {/* Soldé hors facture : possible si pas encore d'invoice OU placeholder sans file */}
                            {(row.status === "not_called" || row.status === "waiting_invoice") && row.commission > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] border-violet-200 text-violet-700 hover:bg-violet-50"
                                onClick={() => markPaidNoInvoice(row)}
                                title="Marquer comme déjà payé hors système (cash, virement direct…)"
                              >
                                <CheckCircle2 className="size-3 mr-0.5" />
                                Hors facture
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px] text-gray-500 hover:text-[#0A3855]"
                              onClick={() => setDetailPartner({
                                id: row.partner_id,
                                name: row.partner_name,
                                email: row.partner_email,
                                commission_ht: row.commission_ht,
                              })}
                              title="Voir le détail toutes années pour ce partenaire"
                            >
                              <Eye className="size-3 mr-0.5" />
                              Détail
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Récap "actions à mener" en bas */}
      {statusFilter === "actionable" && (counts.to_pay + counts.waiting_invoice + counts.not_called) > 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">
            <strong className="text-amber-700">{counts.to_pay} à régler</strong>,{" "}
            <strong className="text-orange-700">{counts.not_called} appels à envoyer</strong>,{" "}
            <strong className="text-blue-700">{counts.waiting_invoice} factures en attente d&apos;upload</strong>.
            Toutes les actions sont disponibles en 1 clic dans la colonne Actions.
          </AlertDescription>
        </Alert>
      )}

      {/* ============ Panneau détail ============ */}
      {detailPartner && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailPartner(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">
                  Facturation — {detailPartner.name}
                </h2>
                <p className="text-[11px] text-gray-400">
                  Détail toutes années · {detailPartner.email || "Pas d&apos;email"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDetailPartner(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-5">
              <PartnerInvoicesAdmin
                partnerId={detailPartner.id}
                partnerName={detailPartner.name}
                partnerEmail={detailPartner.email}
                commissionHt={detailPartner.commission_ht}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left ${className}`}
    >
      {children}
    </th>
  );
}

function FilterPill({
  active,
  label,
  count,
  onClick,
  tone = "gray",
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  tone?: "navy" | "amber" | "blue" | "orange" | "emerald" | "violet" | "gray";
}) {
  const tones: Record<string, { activeBg: string; activeText: string; idleText: string }> = {
    navy: { activeBg: "bg-[#0A3855]", activeText: "text-white", idleText: "text-[#0A3855]" },
    amber: { activeBg: "bg-amber-500", activeText: "text-white", idleText: "text-amber-700" },
    blue: { activeBg: "bg-blue-500", activeText: "text-white", idleText: "text-blue-700" },
    orange: { activeBg: "bg-orange-500", activeText: "text-white", idleText: "text-orange-700" },
    emerald: { activeBg: "bg-emerald-500", activeText: "text-white", idleText: "text-emerald-700" },
    violet: { activeBg: "bg-violet-500", activeText: "text-white", idleText: "text-violet-700" },
    gray: { activeBg: "bg-gray-700", activeText: "text-white", idleText: "text-gray-700" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? `${t.activeBg} ${t.activeText} border-transparent shadow-sm`
          : `bg-white border-gray-200 ${t.idleText} hover:border-gray-300`
      } ${count === 0 && !active ? "opacity-50" : ""}`}
    >
      {label}{" "}
      <span className={`tabular-nums ${active ? "opacity-90" : "opacity-60"}`}>
        ({count})
      </span>
    </button>
  );
}
