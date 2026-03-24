"use client";

import { useState } from "react";
import type { Partner, PartnerType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { useAdminPartners } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/Select";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  Loader2,
  Link2,
  Bookmark,
  Save,
  Search,
  Globe,
  Calendar,
  Code2,
} from "lucide-react";

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
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [type, setType] = useState<PartnerType>("cgp");
  const [campaign, setCampaign] = useState("");
  const [baseUrlKey, setBaseUrlKey] = useState(BASE_URLS[0].value);
  const [customUrl, setCustomUrl] = useState("");
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"generator" | "saved">("generator");

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
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-lg border border-gray-200 w-fit">
        <button
          onClick={() => setActiveSubTab("generator")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeSubTab === "generator"
              ? "bg-[#0A3855] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Link2 className="size-4" />
          Generateur
        </button>
        <button
          onClick={() => setActiveSubTab("saved")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeSubTab === "saved"
              ? "bg-[#0A3855] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Bookmark className="size-4" />
          Sauvegardes ({savedLinks.length})
        </button>
      </div>

      {activeSubTab === "generator" && (
        <>
          {/* Generator form */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-[#0A3855]" />
                Generateur de lien UTM
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Partner selection */}
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label>Partenaire</Label>
                    <div className="relative">
                      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={partnerSearch}
                        onChange={(e) => {
                          setPartnerSearch(e.target.value);
                          setSelectedPartnerId(null);
                        }}
                        placeholder="Rechercher ou saisir..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {partnerSearch && !selectedPartnerId && filteredPartners.length > 0 && (
                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto shadow-lg bg-white">
                      {filteredPartners.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPartnerId(p.id);
                            setPartnerSearch(p.nom);
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#F8FAFB] flex items-center gap-2 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              p.active ? "bg-emerald-500" : "bg-red-400"
                            }`}
                          />
                          <span className="font-medium">{p.nom}</span>
                          <span className="text-xs text-gray-400 ml-auto font-mono">
                            {p.utm}
                          </span>
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

                <div className="space-y-1.5">
                  <Label>Campagne</Label>
                  <Input
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    placeholder="ex: lancement-2026, promo-ete..."
                  />
                </div>

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
            </CardContent>
          </Card>

          {/* Generated link preview */}
          {generatedUrl && (
            <Card className="bg-[#F8FAFB]">
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="size-4 text-gray-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lien genere
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 font-mono text-sm text-[#0A3855] break-all leading-relaxed">
                  {generatedUrl}
                </div>
                <div className="flex gap-2">
                  <CopyButton text={generatedUrl} label="Copier le lien" />
                  <Button variant="outline" onClick={handleSave}>
                    <Save className="size-4 mr-1.5" />
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeSubTab === "saved" && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="size-4 text-[#0A3855]" />
              Liens sauvegardes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {savedLinks.length === 0 ? (
              <div className="text-center py-8">
                <Bookmark className="size-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucun lien sauvegarde</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-4 bg-[#F8FAFB] rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="size-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {link.partner}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10"
                        >
                          {link.campaign}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="size-3" />
                          {new Date(link.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate font-mono">
                        {link.url}
                      </p>
                    </div>
                    <CopyButton text={link.url} label="Copier" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
