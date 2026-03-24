"use client";

import { useState, useMemo } from "react";
import { Users, UserCheck, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Stat, PageHeader } from "@/components/ui";
import { useLeads, useMonthlyStats, useActions } from "@/hooks/usePartnerData";
import { calcCommission } from "@/services/commission";
import { buildSignupLink } from "@/services/links";
import { STAGE_STYLES, SOURCE_STYLES } from "@/services/constants";
import { BarChart } from "./BarChart";
import { EmptyDashboard } from "./EmptyDashboard";
import type { CommissionRule, Lead, LeadStage } from "@/types";

type FilterTab = "all" | "Abonne" | "Payeur" | "Non payeur";

interface DashboardProps {
  partnerId: string;
  partnerType: string;
  commRules: CommissionRule[];
  biensMoyens: number;
  caParClient: number;
  code?: string;
  utm?: string;
  onNavigate: (module: string) => void;
}

export function Dashboard({
  partnerId,
  partnerType,
  commRules,
  biensMoyens,
  caParClient,
  code = "",
  utm = "",
  onNavigate,
}: DashboardProps) {
  const { data: leads = [], isLoading: leadsLoading } = useLeads(partnerId);
  const { data: monthlyStats = [], isLoading: statsLoading } = useMonthlyStats(partnerId);
  const { data: actions = [] } = useActions(partnerId);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Computed values
  const abonnes = leads.filter((l) => l.stage === "Abonne").length;
  const payeurs = leads.filter((l) => l.stage === "Payeur").length;
  const actifs = abonnes + payeurs; // both count for commission
  const commission = calcCommission(commRules, actifs, biensMoyens, caParClient);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (activeTab !== "all") {
      result = result.filter((l) => l.stage === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.nom.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, activeTab, search]);

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
    { key: "Abonne", label: "Abonnes", count: abonnes },
    { key: "Payeur", label: "Payeurs ponctuels", count: payeurs },
    { key: "Non payeur", label: "Non payeurs", count: leads.length - actifs },
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
        subtitle="Suivez vos leads, conversions et commissions en temps reel"
      />

      {/* Revenue Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#0A3855]/80 p-6 sm:p-8 shadow-lg shadow-[#0A3855]/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-2">
              Commission estimee
            </p>
            <p className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              {commission.total.toLocaleString("fr-FR")}&nbsp;&euro;
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {commission.detail.map((d, i) => (
              <div
                key={i}
                className="bg-white/[0.08] backdrop-blur-md border border-white/[0.1] rounded-xl px-4 py-3 min-w-[140px]"
              >
                <p className="text-[11px] text-white/50 font-medium uppercase tracking-wide mb-1">{d.label}</p>
                <p className="text-lg font-bold text-white">{d.montant.toLocaleString("fr-FR")}&nbsp;&euro;</p>
                <p className="text-[10px] text-white/40 mt-0.5">{d.calc}</p>
              </div>
            ))}
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
          <CardTitle className="text-sm font-bold text-gray-900">Evolution mensuelle</CardTitle>
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
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-center">
                    Biens
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">
                    Date
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
                      }`}
                    >
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">
                        {lead.nom}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{lead.email}</td>
                      <td className="px-4 py-3.5">{stageBadge(lead.stage)}</td>
                      <td className="px-4 py-3.5">{sourceBadge(lead.source)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 text-center tabular-nums">
                        {lead.biens}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {formatDate(lead.created_at)}
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
