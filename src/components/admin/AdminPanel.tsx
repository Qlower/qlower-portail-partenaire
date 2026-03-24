"use client";

import { useState } from "react";
import PartnersTab from "./PartnersTab";
import CampagnesTab from "./CampagnesTab";
import BatchTab from "./BatchTab";
import UtmTab from "./UtmTab";
import StatsTab from "./StatsTab";
import FacturationTab from "./FacturationTab";
import SettingsTab from "./SettingsTab";

const TABS = [
  { key: "partenaires", label: "Partenaires" },
  { key: "campagnes", label: "Campagnes" },
  { key: "batch", label: "Batch" },
  { key: "utm", label: "UTM" },
  { key: "stats", label: "Stats" },
  { key: "facturation", label: "Facturation" },
  { key: "parametres", label: "Parametres" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("partenaires");

  return (
    <div>
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-[#0A3855] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "partenaires" && <PartnersTab />}
      {activeTab === "campagnes" && <CampagnesTab />}
      {activeTab === "batch" && <BatchTab />}
      {activeTab === "utm" && <UtmTab />}
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "facturation" && <FacturationTab />}
      {activeTab === "parametres" && <SettingsTab />}
    </div>
  );
}
