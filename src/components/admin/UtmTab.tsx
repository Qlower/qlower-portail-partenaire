"use client";

import { useState, useEffect } from "react";
import type { Partner, PartnerType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { api } from "@/lib/axios";
import { Card, Button, Input, Select, CopyButton, Badge } from "@/components/ui";

const BASE_URLS = [
  { value: "https://secure.qlower.com/signup", label: "Inscription Qlower" },
  { value: "https://www.qlower.com", label: "Site vitrine" },
  { value: "https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower", label: "RDV HubSpot" },
  { value: "custom", label: "URL personnalisee" },
];

interface SavedLink {
  id: string;
  partner: string;
  url: string;
  campaign: string;
  createdAt: string;
}

export default function UtmTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [type, setType] = useState<PartnerType>("cgp");
  const [campaign, setCampaign] = useState("");
  const [baseUrlKey, setBaseUrlKey] = useState(BASE_URLS[0].value);
  const [customUrl, setCustomUrl] = useState("");
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"generator" | "saved">("generator");

  useEffect(() => {
    api
      .get("/admin/partners")
      .then((res) => setPartners(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredPartners = partners.filter(
    (p) =>
      p.nom.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);

  const baseUrl = baseUrlKey === "custom" ? customUrl : baseUrlKey;
  const utmSource = selectedPartner?.utm || partnerSearch || "partner";
  const utmMedium = type;
  const utmCampaign = campaign || "default";

  const generatedUrl = baseUrl
    ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`
    : "";

  const handleSave = () => {
    if (!generatedUrl) return;
    const link: SavedLink = {
      id: Date.now().toString(),
      partner: selectedPartner?.nom || partnerSearch || "Inconnu",
      url: generatedUrl,
      campaign: utmCampaign,
      createdAt: new Date().toISOString(),
    };
    setSavedLinks((prev) => [link, ...prev]);
    setActiveSubTab("saved");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSubTab("generator")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            activeSubTab === "generator"
              ? "bg-[#0A3855] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Generateur
        </button>
        <button
          onClick={() => setActiveSubTab("saved")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            activeSubTab === "saved"
              ? "bg-[#0A3855] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Sauvegardes ({savedLinks.length})
        </button>
      </div>

      {activeSubTab === "generator" && (
        <>
          {/* Generator form */}
          <Card>
            <h4 className="font-semibold text-gray-900 mb-4">Generateur de lien UTM</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Partner selection */}
              <div className="space-y-2">
                <Input
                  label="Partenaire"
                  value={partnerSearch}
                  onChange={(e) => {
                    setPartnerSearch(e.target.value);
                    setSelectedPartnerId(null);
                  }}
                  placeholder="Rechercher ou saisir..."
                />
                {partnerSearch && !selectedPartnerId && filteredPartners.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {filteredPartners.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPartnerId(p.id);
                          setPartnerSearch(p.nom);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${p.active ? "bg-green-500" : "bg-red-400"}`} />
                        <span>{p.nom}</span>
                        <span className="text-xs text-gray-400 ml-auto">{p.utm}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Select
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value as PartnerType)}
                options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
              />

              <Input
                label="Campagne"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="ex: lancement-2026, promo-ete..."
              />

              <div>
                <Select
                  label="URL de base"
                  value={baseUrlKey}
                  onChange={(e) => setBaseUrlKey(e.target.value)}
                  options={BASE_URLS}
                />
                {baseUrlKey === "custom" && (
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </Card>

          {/* Generated link preview */}
          {generatedUrl && (
            <Card className="bg-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-2">Lien genere</p>
              <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 break-all">
                <code className="text-sm text-[#0A3855]">{generatedUrl}</code>
              </div>
              <div className="flex gap-2">
                <CopyButton text={generatedUrl} label="Copier le lien" />
                <Button variant="secondary" onClick={handleSave}>
                  Sauvegarder
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {activeSubTab === "saved" && (
        <Card>
          <h4 className="font-semibold text-gray-900 mb-4">Liens sauvegardes</h4>
          {savedLinks.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun lien sauvegarde</p>
          ) : (
            <div className="space-y-2">
              {savedLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{link.partner}</span>
                      <Badge variant="blue">{link.campaign}</Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(link.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{link.url}</p>
                  </div>
                  <CopyButton text={link.url} label="Copier" />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
