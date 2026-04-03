"use client";

import { useState, useMemo } from "react";
import PartnersTab from "./PartnersTab";
import CampagnesTab from "./CampagnesTab";
import BatchTab from "./BatchTab";
import UtmTab from "./UtmTab";
import StatsTab from "./StatsTab";
import FacturationTab from "./FacturationTab";
import SettingsTab from "./SettingsTab";
import { useAdminPartners, useSyncHubspot } from "@/hooks/useAdminData";
import {
  Users,
  Megaphone,
  Layers,
  Link2,
  BarChart3,
  Receipt,
  Settings,
  RefreshCw,
} from "lucide-react";

const TABS = [
  { key: "partenaires", label: "Partenaires", icon: Users },
  { key: "campagnes", label: "Campagnes", icon: Megaphone },
  { key: "batch", label: "Batch", icon: Layers },
  { key: "utm", label: "UTM", icon: Link2 },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "facturation", label: "Facturation", icon: Receipt },
  { key: "parametres", label: "Parametres", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("partenaires");
  const { data: partners = [] } = useAdminPartners();
  const syncHubspot = useSyncHubspot();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const newPartnersCount = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return partners.filter((p) => new Date(p.created_at) >= sevenDaysAgo).length;
  }, [partners]);

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="text-sm text-green-600 font-medium">
              {syncMessage}
            </span>
          )}
          <button
            onClick={async () => {
              setSyncMessage(null);
              try {
                const result = await syncHubspot.mutateAsync();
                setSyncMessage(
                  `Sync OK : ${result.synced} nouveaux, ${result.updated} mis a jour, ${result.skipped} ignores`
                );
              } catch {
                setSyncMessage("Erreur lors de la synchronisation");
              }
            }}
            disabled={syncHubspot.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0A3855] text-white hover:bg-[#0A3855]/90 disabled:opacity-50 transition-all"
          >
            <RefreshCw
              className={`size-4 ${syncHubspot.isPending ? "animate-spin" : ""}`}
            />
            {syncHubspot.isPending ? "Sync en cours..." : "Sync HubSpot"}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="flex flex-wrap gap-1 p-1 bg-white rounded-xl border border-gray-200/80 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const badge = tab.key === "partenaires" && newPartnersCount > 0 ? newPartnersCount : 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#0A3855] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      <div>
        {activeTab === "partenaires" && <PartnersTab />}
        {activeTab === "campagnes" && <CampagnesTab />}
        {activeTab === "batch" && <BatchTab />}
        {activeTab === "utm" && <UtmTab />}
        {activeTab === "stats" && <StatsTab />}
        {activeTab === "facturation" && <FacturationTab />}
        {activeTab === "parametres" && <SettingsTab />}
      </div>
    </div>
  );
}
