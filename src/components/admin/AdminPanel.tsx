"use client";

import { useState } from "react";
import PartnersTab from "./PartnersTab";
import CampagnesTab from "./CampagnesTab";
import BatchTab from "./BatchTab";
import UtmTab from "./UtmTab";
import StatsTab from "./StatsTab";
import FacturationTab from "./FacturationTab";
import SettingsTab from "./SettingsTab";
import {
  Users,
  Megaphone,
  Layers,
  Link2,
  BarChart3,
  Receipt,
  Settings,
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

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <nav className="flex flex-wrap gap-1 p-1 bg-white rounded-xl border border-gray-200/80 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#0A3855] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
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
