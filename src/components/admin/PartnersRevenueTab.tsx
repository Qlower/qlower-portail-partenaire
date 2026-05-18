"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Euro,
  Users,
  TrendingUp,
  Search,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Lock,
  CreditCard,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================
interface YearBucket {
  ca: number;
  charges: number;
  clients: number;
}
interface PartnerRevenue {
  partner_id: string;
  partner_name: string;
  partner_code: string;
  partner_utm: string;
  active: boolean;
  total_ca: number;
  total_charges: number;
  unique_clients: number;
  by_year: Record<string, YearBucket>;
}
interface RevenueResponse {
  total: { ca: number; charges: number; unique_clients: number };
  matched: { ca: number; charges: number; unique_clients: number };
  unmatched: { ca: number; charges: number; unique_clients: number };
  by_year: Array<{ year: number; ca: number; charges: number; uniqueClients: number }>;
  by_partner: PartnerRevenue[];
}

// ============================================================================
// Format helpers
// ============================================================================
const fmtEUR = (n: number) =>
  Math.round(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

// ============================================================================
// Main tab
// ============================================================================
export default function PartnersRevenueTab() {
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<RevenueResponse>({
    queryKey: ["admin-partners-revenue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/partners-revenue");
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Liste des années disponibles
  const availableYears = useMemo<number[]>(() => {
    if (!data) return [];
    return data.by_year.map((y) => y.year);
  }, [data]);

  // Filtrage de la liste partenaires
  const filteredPartners = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.by_partner.filter((p) => {
      if (activeOnly && !p.active) return false;
      if (yearFilter !== "all" && !p.by_year[String(yearFilter)]) return false;
      if (!q) return true;
      return (
        p.partner_name.toLowerCase().includes(q) ||
        p.partner_code.toLowerCase().includes(q) ||
        p.partner_utm.toLowerCase().includes(q)
      );
    });
  }, [data, search, activeOnly, yearFilter]);

  // KPI scoped à l'année sélectionnée
  const scopedKpi = useMemo(() => {
    if (!data) return null;
    if (yearFilter === "all") {
      return {
        ca: data.matched.ca,
        clients: data.matched.unique_clients,
        partners: data.by_partner.length,
        avgPerPartner:
          data.by_partner.length > 0
            ? Math.round(data.matched.ca / data.by_partner.length)
            : 0,
      };
    }
    const yearStr = String(yearFilter);
    let ca = 0;
    const clientSet = new Set<string>(); // approximation: total clients across partners with revenue this year
    let partnersWithRev = 0;
    for (const p of data.by_partner) {
      const y = p.by_year[yearStr];
      if (!y) continue;
      ca += y.ca;
      partnersWithRev++;
      // Note: union exacte des emails par partenaire-année n'est pas exposée
      // côté serveur — on prend la somme des `clients` par partenaire comme proxy.
      // Ça peut sur-compter si un client est attribué à plusieurs partenaires
      // mais on a déjà déduplifié côté serveur (1 lead par email → 1 partenaire).
      for (let i = 0; i < y.clients; i++) clientSet.add(`${p.partner_id}-${i}`);
    }
    return {
      ca,
      clients: clientSet.size,
      partners: partnersWithRev,
      avgPerPartner: partnersWithRev > 0 ? Math.round(ca / partnersWithRev) : 0,
    };
  }, [data, yearFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Calcul du CA généré par les apporteurs…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          {error instanceof Error ? error.message : "Impossible de charger les revenus."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bandeau confidentialité */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <Lock className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-900 leading-relaxed">
          <strong>Vue admin uniquement.</strong> Les revenus Stripe bruts apportés
          par les clients de chaque partenaire ne sont jamais visibles côté
          partenaire (seule la <em>commission calculée</em> leur est exposée).
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#0A3855] text-white border-none">
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Euro className="size-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
                  CA généré {yearFilter === "all" ? "(tout)" : yearFilter}
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {fmtEUR(scopedKpi?.ca || 0)} €
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  par les clients d&apos;apporteurs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFF5ED] flex items-center justify-center">
                <Users className="size-5 text-[#B8864E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Clients payeurs
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {scopedKpi?.clients || 0}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  uniques (1 lead = 1 partenaire)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E5EDF1] flex items-center justify-center">
                <CreditCard className="size-5 text-[#0A3855]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Partenaires monétisés
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {scopedKpi?.partners || 0}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  avec au moins 1 € de CA
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  CA moyen / partenaire
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {fmtEUR(scopedKpi?.avgPerPartner || 0)} €
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  parmi les partenaires monétisés
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CA par année */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-[#0A3855] flex items-center gap-1.5">
              <TrendingUp className="size-4" />
              Évolution année par année
            </h3>
            <span className="text-[10px] text-gray-400">
              Total tous partenaires (matchés et non matchés)
            </span>
          </div>
          {data.by_year.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune donnée de CA disponible.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {data.by_year.map((y) => (
                <button
                  key={y.year}
                  onClick={() =>
                    setYearFilter(yearFilter === y.year ? "all" : y.year)
                  }
                  className={`text-left p-3 rounded-lg border transition-all ${
                    yearFilter === y.year
                      ? "border-[#0A3855] bg-[#E5EDF1]/50"
                      : "border-gray-100 hover:border-gray-300"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                    {y.year}
                  </p>
                  <p className="text-lg font-bold text-[#0A3855] tabular-nums mt-0.5">
                    {fmtEUR(y.ca)} €
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {y.uniqueClients} client{y.uniqueClients > 1 ? "s" : ""} ·{" "}
                    {y.charges} charge{y.charges > 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            placeholder="Rechercher partenaire / code / UTM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <select
          value={String(yearFilter)}
          onChange={(e) =>
            setYearFilter(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
          }
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white hover:border-gray-300 font-medium text-[#0A3855]"
        >
          <option value="all">Toutes années</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          onClick={() => setActiveOnly((v) => !v)}
          className={`text-xs px-2.5 py-1.5 rounded border font-medium transition-colors ${
            activeOnly
              ? "bg-[#0A3855] text-white border-[#0A3855]"
              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
          }`}
        >
          Actifs uniquement
        </button>
        <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855]">
          {filteredPartners.length} partenaire{filteredPartners.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Tableau partenaires */}
      {filteredPartners.length === 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Aucun partenaire monétisé pour ces filtres.
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
                    <Th className="text-right">
                      CA {yearFilter === "all" ? "total" : yearFilter}
                    </Th>
                    <Th className="text-right">Clients</Th>
                    <Th className="text-right">Charges</Th>
                    <Th className="text-right">CA / client</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPartners.map((p) => {
                    const scopedYear =
                      yearFilter === "all" ? null : p.by_year[String(yearFilter)];
                    const ca = yearFilter === "all" ? p.total_ca : scopedYear?.ca || 0;
                    const clients =
                      yearFilter === "all" ? p.unique_clients : scopedYear?.clients || 0;
                    const charges =
                      yearFilter === "all" ? p.total_charges : scopedYear?.charges || 0;
                    const avgPerClient = clients > 0 ? Math.round(ca / clients) : 0;
                    const expanded = expandedId === p.partner_id;
                    return (
                      <>
                        <tr
                          key={p.partner_id}
                          className="hover:bg-[#E5EDF1]/15 cursor-pointer"
                          onClick={() =>
                            setExpandedId(expanded ? null : p.partner_id)
                          }
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {expanded ? (
                                <ChevronDown className="size-3.5 text-gray-400" />
                              ) : (
                                <ChevronRight className="size-3.5 text-gray-400" />
                              )}
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold text-gray-900">
                                  {p.partner_name}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {p.partner_code} · {p.partner_utm}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="font-bold text-[#0A3855] text-base">
                              {fmtEUR(ca)} €
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {clients}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                            {charges}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                            {fmtEUR(avgPerClient)} €
                          </td>
                          <td className="px-3 py-2.5">
                            {p.active ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] shadow-none">
                                Actif
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-50 text-gray-500 border border-gray-200 text-[10px] shadow-none">
                                Inactif
                              </Badge>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={p.partner_id + "-detail"} className="bg-[#FFF5ED]/30">
                            <td colSpan={6} className="px-3 py-3">
                              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                Répartition année par année
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                {Object.entries(p.by_year)
                                  .sort(([a], [b]) => Number(b) - Number(a))
                                  .map(([year, v]) => (
                                    <div
                                      key={year}
                                      className="bg-white border border-gray-100 rounded p-2"
                                    >
                                      <p className="text-[10px] font-semibold text-gray-500">
                                        {year}
                                      </p>
                                      <p className="text-base font-bold text-[#0A3855] tabular-nums">
                                        {fmtEUR(v.ca)} €
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        {v.clients} client{v.clients > 1 ? "s" : ""} ·{" "}
                                        {v.charges} charge{v.charges > 1 ? "s" : ""}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer : explication clients non rattachés */}
      {data.unmatched.ca > 0 && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs leading-relaxed">
            <strong>{fmtEUR(data.unmatched.ca)} € de CA</strong> proviennent de{" "}
            <strong>{data.unmatched.unique_clients}</strong> client(s) Stripe non
            rattachés à un partenaire (acquisition directe / pas de lead en DB /
            email différent entre Stripe et HubSpot). Pour rattacher des clients
            via leur code promo, va dans <strong>Paramètres → Rattachement codes
            promo Stripe</strong>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left ${className}`}
    >
      {children}
    </th>
  );
}
