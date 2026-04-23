"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminPartners } from "@/hooks/useAdminData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import PartnerInvoicesAdmin from "./PartnerInvoicesAdmin";
import {
  Loader2,
  Receipt,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";

type CommSummary = {
  partnerId: string;
  totalSubscribers: number;
  totalCommission: number;
};

type AdminInvoice = {
  id: string;
  partner_id: string;
  year: number;
  amount: number;
  file_url: string | null;
  uploaded_at: string | null;
  is_paid: boolean;
  paid_at: string | null;
  historical: boolean;
};

export default function FacturationTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Real commissions per partner (HubSpot live, same logic as partner dashboard)
  const { data: commSummaries = [] } = useQuery<CommSummary[]>({
    queryKey: ["admin-partners-commissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/partners-commissions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  const commByPartner = new Map(commSummaries.map((c) => [c.partnerId, c]));

  // All invoices (to compute statuses per partner)
  const { data: allInvoices = [] } = useQuery<AdminInvoice[]>({
    queryKey: ["admin-all-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invoices");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  const invoicesByPartner = new Map<string, AdminInvoice[]>();
  for (const inv of allInvoices) {
    const arr = invoicesByPartner.get(inv.partner_id) ?? [];
    arr.push(inv);
    invoicesByPartner.set(inv.partner_id, arr);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement de la facturation...</p>
      </div>
    );
  }

  const activePartners = partners.filter((p) => p.active);
  const filtered = activePartners.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.utm || "").toLowerCase().includes(q)
    );
  });

  // Totals
  const totalDue = commSummaries.reduce((s, c) => s + (c.totalCommission || 0), 0);
  let totalPending = 0;
  let totalPaid = 0;
  for (const inv of allInvoices) {
    if (inv.historical) continue;
    if (inv.is_paid) totalPaid += Number(inv.amount) || 0;
    else if (inv.file_url) totalPending += Number(inv.amount) || 0;
  }

  // Status computation for each partner
  const partnerStatus = (partnerId: string): "waiting" | "uploaded" | "paid" | "none" => {
    const invs = invoicesByPartner.get(partnerId) ?? [];
    const nonHistorical = invs.filter((i) => !i.historical);
    if (nonHistorical.length === 0) return "none";
    if (nonHistorical.every((i) => i.is_paid)) return "paid";
    if (nonHistorical.some((i) => i.file_url && !i.is_paid)) return "uploaded";
    return "waiting";
  };

  const statusBadge = (status: ReturnType<typeof partnerStatus>) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] shadow-none">
            <CheckCircle2 className="size-3 mr-0.5" />
            Soldé
          </Badge>
        );
      case "uploaded":
        return (
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] shadow-none">
            Facture reçue
          </Badge>
        );
      case "waiting":
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] shadow-none">
            <Clock className="size-3 mr-0.5" />
            En attente
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-50 text-gray-500 border border-gray-200 text-[10px] shadow-none">
            Aucune action
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Totaux en tête */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0A3855] text-white border-none">
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Receipt className="size-5 text-white/80" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
                  Commissions dues
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {totalDue.toLocaleString("fr-FR")} €
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Cumul sur {activePartners.length} partenaires actifs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  À régler
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {totalPending.toLocaleString("fr-FR")} €
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Factures reçues non payées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Réglé
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {totalPaid.toLocaleString("fr-FR")} €
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Total déjà payé</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            placeholder="Rechercher partenaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855]">
          {filtered.length}/{activePartners.length} partenaires
        </Badge>
      </div>

      {/* Liste partenaires */}
      {filtered.length === 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>Aucun partenaire correspondant.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const comm = commByPartner.get(p.id);
            const commission = comm?.totalCommission ?? 0;
            const subscribers = comm?.totalSubscribers ?? 0;
            const status = partnerStatus(p.id);
            const isExpanded = expandedId === p.id;

            return (
              <Card
                key={p.id}
                className={`transition-all ${isExpanded ? "ring-1 ring-[#0A3855]/20" : ""}`}
              >
                <CardContent>
                  <div
                    className="flex items-center justify-between cursor-pointer gap-3 flex-wrap"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-gray-900 truncate">{p.nom}</span>
                      <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded hidden sm:inline">
                        {p.code}
                      </span>
                      {statusBadge(status)}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#0A3855] tabular-nums leading-tight">
                          {commission.toLocaleString("fr-FR")} €
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {subscribers} abonné{subscribers > 1 ? "s" : ""} cumulés
                        </p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <PartnerInvoicesAdmin
                        partnerId={p.id}
                        partnerName={p.nom}
                        partnerEmail={p.email}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
