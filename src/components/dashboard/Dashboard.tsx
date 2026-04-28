"use client";

import { useState, useMemo } from "react";
import { Users, UserCheck, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Stat, PageHeader } from "@/components/ui";
import { useLeads, useMonthlyStats, useActions, useCommissions } from "@/hooks/usePartnerData";
import { STAGE_STYLES, SOURCE_STYLES } from "@/services/constants";
import { BarChart } from "./BarChart";
import { EmptyDashboard } from "./EmptyDashboard";
import type { LeadStage } from "@/types";

type FilterTab = "all" | "Abonne" | "Payeur" | "Non payeur";

interface DashboardProps {
  partnerId: string;
  partnerType: string;
  code?: string;
  utm?: string;
  onNavigate: (module: string) => void;
}

export function Dashboard({
  partnerId,
  partnerType,
  code = "",
  utm = "",
  onNavigate,
}: DashboardProps) {
  const { data: leads = [], isLoading: leadsLoading } = useLeads(partnerId);
  const { data: monthlyStats = [], isLoading: statsLoading } = useMonthlyStats(partnerId);
  const { data: actions = [] } = useActions(partnerId);
  const currentYear = new Date().getFullYear();
  type YearFilter = number | "all";
  const [selectedYear, setSelectedYear] = useState<YearFilter>("all");
  const { data: commissionData } = useCommissions(partnerId, selectedYear);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Dropdown années : de la plus vieille date d'activité connue → année courante
  const yearOptions = useMemo<YearFilter[]>(() => {
    const years = new Set<number>();
    for (const l of leads) {
      for (const d of [l.created_at, l.first_paid_at, l.subscribed_at, l.unsubscribed_at]) {
        if (d) {
          const y = new Date(d).getFullYear();
          if (!isNaN(y)) years.add(y);
        }
      }
    }
    // Toujours proposer au moins currentYear et currentYear-1
    years.add(currentYear);
    years.add(currentYear - 1);
    const sorted = Array.from(years).sort((a, b) => b - a); // desc
    return ["all", ...sorted];
  }, [leads, currentYear]);

  // Computed values (all-time totals — independent of year filter)
  const abonnes = leads.filter((l) => l.stage === "Abonne").length;
  const payeurs = leads.filter((l) => l.stage === "Payeur").length;
  const nonPayeurs = leads.filter((l) => l.stage === "Non payeur").length;

  // Activity in a given year: recommended OR first-paid OR subscribed (fallback) OR unsubscribed in that year
  const hasActivityInYear = (lead: typeof leads[number], y: number): boolean => {
    const yr = (s?: string | null) => (s ? new Date(s).getFullYear() : null);
    return (
      yr(lead.created_at) === y ||
      yr(lead.first_paid_at) === y ||
      yr(lead.subscribed_at) === y ||
      yr(lead.unsubscribed_at) === y
    );
  };

  // Filtered leads (stage tab + search + year activity)
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (activeTab !== "all") {
      result = result.filter((l) => l.stage === activeTab);
    }
    if (selectedYear !== "all") {
      result = result.filter((l) => hasActivityInYear(l, selectedYear));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.nom.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q)
      );
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, activeTab, search, selectedYear]);

  // Chart data
  const chartData = monthlyStats.map((s) => ({
    mois: s.mois,
    leads: s.leads,
    abonnes: s.abonnes,
  }));

  // Loading
  if (leadsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#E5EDF1]" />
          <div className="absolute inset-0 rounded-full border-2 border-[#0A3855] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Empty state
  if (leads.length === 0) {
    return <EmptyDashboard code={code} utm={utm} onNavigate={onNavigate} />;
  }

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "Tous", count: leads.length },
    { key: "Abonne", label: "Abonnés", count: abonnes },
    { key: "Payeur", label: "Payeurs ponctuels", count: payeurs },
    { key: "Non payeur", label: "Non payeurs", count: nonPayeurs },
  ];

  const stageBadge = (stage: LeadStage) => {
    const s = STAGE_STYLES[stage] || STAGE_STYLES["Non payeur"];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.text === "text-green-700" ? "bg-green-500" : s.text === "text-blue-700" ? "bg-blue-500" : "bg-gray-400"}`} />
        {stage}
      </span>
    );
  };

  const sourceBadge = (source: string) => {
    const s = SOURCE_STYLES[source] || SOURCE_STYLES.UTM;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {source}
      </span>
    );
  };

  const handleExport = () => {
    window.open(`/api/export/leads?partner_id=${partnerId}`, "_blank");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Suivez vos leads, conversions et commissions en temps réel"
      />

      {/* Revenue Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#0A3855]/80 p-6 sm:p-8 shadow-lg shadow-[#0A3855]/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest">
                Commission
              </p>
              <select
                value={String(selectedYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedYear(v === "all" ? "all" : Number(v));
                }}
                className="bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-white/10 text-xs font-bold text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {yearOptions.map((y) => (
                  <option key={String(y)} value={String(y)} className="bg-[#0A3855] text-white">
                    {y === "all" ? "Toutes années" : y}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              {(commissionData?.totalCommission ?? 0).toLocaleString("fr-FR")}&nbsp;&euro;
              <span className="text-base font-medium text-white/50 ml-2">
                {commissionData?.commissionHt ? "HT" : "TTC"}
              </span>
            </p>
            {/* Résumé court (cumul / année) */}
            <p className="text-xs text-white/40 mt-1">
              {selectedYear === "all" ? (
                <>Cumul historique sur {commissionData?.totalSubscribers ?? 0} abonné{(commissionData?.totalSubscribers ?? 0) > 1 ? "s" : ""}</>
              ) : (
                <>Pour l&apos;année {selectedYear} — {commissionData?.totalSubscribers ?? 0} abonné{(commissionData?.totalSubscribers ?? 0) > 1 ? "s" : ""}</>
              )}
            </p>
            {/* Détail des règles actives — masque les inactives pour ne pas exposer les options */}
            {commissionData?.ruleDetails && commissionData.ruleDetails.filter((r) => r.montant > 0).length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                  Votre mode de calcul
                </p>
                <div className="space-y-0.5">
                  {commissionData.ruleDetails
                    .filter((r) => r.montant > 0)
                    .map((r, i) => (
                      <p key={i} className="text-[11px] text-white/60 leading-relaxed">
                        <span className="font-semibold text-white/80">{r.label}</span> :{" "}
                        {r.montant}&nbsp;€&nbsp;{commissionData.commissionHt ? "HT" : "TTC"}
                        {r.type === "recurring"
                          ? " par abonné actif, chaque année"
                          : " par nouvel abonné (année de souscription)"}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/[0.08] backdrop-blur-md border border-white/[0.1] rounded-xl px-4 py-3 min-w-[140px]">
              <p className="text-[11px] text-white/50 font-medium uppercase tracking-wide mb-1">
                {selectedYear === "all" ? "Abonnés (toutes)" : `Abonnés ${selectedYear}`}
              </p>
              <p className="text-lg font-bold text-white">{commissionData?.totalSubscribers ?? 0}</p>
              <p className="text-[10px] text-white/40 mt-0.5">sur {commissionData?.totalContacts ?? 0} contacts</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-md border border-white/[0.1] rounded-xl px-4 py-3 min-w-[140px]">
              <p className="text-[11px] text-white/50 font-medium uppercase tracking-wide mb-1">
                Année {commissionData?.previousYear?.year ?? currentYear - 1}
              </p>
              <p className="text-lg font-bold text-white">{(commissionData?.previousYear.totalCommission ?? 0).toLocaleString("fr-FR")}&nbsp;&euro;</p>
              <p className="text-[10px] text-white/40 mt-0.5">{commissionData?.previousYear.totalSubscribers ?? 0} abonné{(commissionData?.previousYear.totalSubscribers ?? 0) > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat
          icon={<Users className="w-5 h-5" />}
          value={leads.length}
          label="Total leads"
          subtitle="Contacts générés"
        />
        <Stat
          icon={<UserCheck className="w-5 h-5" />}
          value={abonnes}
          label="Abonnés"
          subtitle="Abonnement actif"
        />
        <Stat
          icon={<CreditCard className="w-5 h-5" />}
          value={payeurs}
          label="Payeurs ponctuels"
          subtitle="Sans abonnement"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-gray-900">Évolution mensuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={chartData} />
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="pt-2">
          {/* Table Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-[#0A3855] text-white shadow-md shadow-[#0A3855]/20"
                      : "bg-[#E5EDF1] text-[#0A3855]/70 hover:bg-[#0A3855]/10 hover:text-[#0A3855]"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-1.5 tabular-nums ${activeTab === tab.key ? "text-white/60" : "text-[#0A3855]/40"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search + Export */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-52 pl-9 pr-3 py-2 text-xs bg-[#E5EDF1]/50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855]/40 focus:bg-white transition-all placeholder:text-gray-400"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <Button variant="outline" className="text-xs rounded-full px-4" onClick={handleExport}>
                <svg className="w-3.5 h-3.5 mr-1.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exporter
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#E5EDF1]/40">
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Recommandé le
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Abonné depuis
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <p className="text-sm text-gray-400">Aucun lead ne correspond aux filtres</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      className={`group transition-colors hover:bg-[#E5EDF1]/30 ${
                        idx !== filteredLeads.length - 1 ? "border-b border-gray-100/80" : ""
                      } ${lead.hs_deleted ? "opacity-70" : ""}`}
                    >
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className={lead.hs_deleted ? "text-gray-400 italic" : ""}>
                            {lead.nom}
                          </span>
                          {lead.hs_deleted && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200"
                              title={
                                lead.hs_deleted_at
                                  ? `Supprimé le ${new Date(lead.hs_deleted_at).toLocaleDateString("fr-FR")}`
                                  : "Compte supprimé (droit à l'effacement)"
                              }
                            >
                              Supprimé
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        <span className={lead.hs_deleted ? "italic text-gray-400" : ""}>
                          {lead.email || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{stageBadge(lead.stage)}</td>
                      <td className="px-4 py-3.5">{sourceBadge(lead.source)}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {(() => {
                          // Source principale : first_paid_at (date premier paiement, immuable).
                          // Fallback : subscribed_at (hs_v2_date_entered_999998694).
                          const displayDate = lead.first_paid_at || lead.subscribed_at;
                          if (!displayDate) return <span className="text-gray-300">—</span>;

                          const mainD = new Date(displayDate);
                          const subD = lead.subscribed_at ? new Date(lead.subscribed_at) : null;
                          const unsubD = lead.unsubscribed_at ? new Date(lead.unsubscribed_at) : null;

                          // Detect HubSpot workflow glitch: entry and exit within a few seconds
                          // = bulk re-processing, not a real cycle. Ignore the exit entirely.
                          const isGlitch = !!(subD && unsubD && Math.abs(subD.getTime() - unsubD.getTime()) < 60000);

                          const isResub = !isGlitch && lead.stage === "Abonne" && unsubD && subD && unsubD < subD;
                          const isReallyUnsub = !isGlitch && lead.stage !== "Abonne" && unsubD && unsubD >= mainD;

                          return (
                            <div className="flex flex-col">
                              <span className="text-gray-600 font-medium">
                                {formatDate(mainD.toISOString())}
                              </span>
                              {isReallyUnsub && unsubD && (
                                <span
                                  className="text-[10px] text-orange-600"
                                  title={`Désabonné le ${unsubD.toLocaleDateString("fr-FR")}`}
                                >
                                  Désabonné le {formatDate(unsubD.toISOString())}
                                </span>
                              )}
                              {isResub && !isReallyUnsub && unsubD && (
                                <span
                                  className="text-[10px] text-blue-600"
                                  title={`Déjà désabonné le ${unsubD.toLocaleDateString("fr-FR")} puis ré-abonné`}
                                >
                                  Réabonnement
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
