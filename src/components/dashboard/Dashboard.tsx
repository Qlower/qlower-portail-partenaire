"use client";

import { useState, useMemo } from "react";
import { Card, Button, Badge, Stat, PageHeader } from "@/components/ui";
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
        <div className="w-8 h-8 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin" />
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
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {stage}
      </span>
    );
  };

  const sourceBadge = (source: string) => {
    const s = SOURCE_STYLES[source] || SOURCE_STYLES.UTM;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
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
    <div className="space-y-5">
      <PageHeader
        title="Tableau de bord"
        subtitle="Suivez vos leads, conversions et commissions en temps reel"
      />

      {/* Revenue Card */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-0" padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              Commission estimee
            </p>
            <p className="text-3xl font-bold text-white">
              {commission.total.toLocaleString("fr-FR")}&nbsp;&euro;
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {commission.detail.map((d, i) => (
              <div key={i} className="bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] text-gray-400 font-medium">{d.label}</p>
                <p className="text-sm font-bold text-white">{d.montant.toLocaleString("fr-FR")}&nbsp;&euro;</p>
                <p className="text-[10px] text-gray-500">{d.calc}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon="&#x1F465;" value={leads.length} label="Total leads" subtitle="Contacts generes" />
        <Stat icon="&#x2705;" value={abonnes} label="Abonnes" subtitle="Abonnement actif" />
        <Stat icon="&#x1F4B3;" value={payeurs} label="Payeurs ponctuels" subtitle="Sans abonnement" />
      </div>

      {/* Chart */}
      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-4">Evolution mensuelle</h3>
        <BarChart data={chartData} />
      </Card>

      {/* Leads Table */}
      <Card padding="sm">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#0A3855] text-white shadow-sm"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1.5 ${activeTab === tab.key ? "text-white/70" : "text-gray-400"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A3855]/30 focus:border-[#0A3855]"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Button variant="outline" className="text-xs px-3 py-1.5" onClick={handleExport}>
              Exporter .xlsx
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Biens
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                    Aucun lead ne correspond aux filtres
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">
                      {lead.nom}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500">{lead.email}</td>
                    <td className="px-3 py-2.5">{stageBadge(lead.stage)}</td>
                    <td className="px-3 py-2.5">{sourceBadge(lead.source)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 text-center">
                      {lead.biens}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
