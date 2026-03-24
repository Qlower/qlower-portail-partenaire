"use client";

import { useState } from "react";
import type { Partner, ContratType } from "@/types";
import { useAdminPartners } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select } from "@/components/ui/Select";
import {
  Loader2,
  Target,
  FileText,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Info,
  Mail,
} from "lucide-react";

type Audience = "tous" | "affiliation" | "marque_blanche";

interface EmailTemplate {
  key: string;
  title: string;
  description: string;
  subject: (partner: Partner) => string;
  body: (partner: Partner) => string;
}

const TEMPLATES: EmailTemplate[] = [
  {
    key: "presentation",
    title: "Presentation du programme",
    description: "Email de bienvenue presentant le programme partenaire et les avantages.",
    subject: (p) => `Bienvenue dans le programme partenaire Qlower, ${p.nom} !`,
    body: (p) =>
      `Bonjour ${p.nom},\n\nNous sommes ravis de vous accueillir dans le programme partenaire Qlower.\n\nVotre lien d'inscription personnalise : https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}\n\nVotre identifiant partenaire : ${p.code}\n\nN'hesitez pas a nous contacter pour toute question.\n\nL'equipe Qlower`,
  },
  {
    key: "relance",
    title: "Relance activation",
    description: "Relance pour les partenaires qui n'ont pas encore genere de leads.",
    subject: (p) => `${p.nom}, activez votre partenariat Qlower`,
    body: (p) =>
      `Bonjour ${p.nom},\n\nNous avons remarque que votre lien partenaire n'a pas encore ete utilise.\n\nRappel de votre lien : https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}\n\nN'hesitez pas a le partager avec vos clients proprietaires bailleurs.\n\nL'equipe Qlower`,
  },
  {
    key: "performance",
    title: "Bilan de performance",
    description: "Bilan mensuel avec les metriques cles du partenaire.",
    subject: (p) => `Bilan partenaire Qlower -- ${p.nom}`,
    body: (p) =>
      `Bonjour ${p.nom},\n\nVoici votre bilan de performance :\n- Leads generes : ${p.leads}\n- Abonnes convertis : ${p.abonnes}\n- Taux de conversion : ${p.leads > 0 ? ((p.abonnes / p.leads) * 100).toFixed(1) : "0"}%\n\nContinuez vos efforts !\n\nL'equipe Qlower`,
  },
  {
    key: "nouveaute",
    title: "Annonce nouveaute",
    description: "Annonce d'une nouvelle fonctionnalite ou mise a jour du programme.",
    subject: () => `Nouveaute Qlower -- Programme partenaire`,
    body: (p) =>
      `Bonjour ${p.nom},\n\nNous avons le plaisir de vous annoncer une nouveaute dans notre programme partenaire.\n\n[Contenu de l'annonce a personnaliser]\n\nVotre lien reste inchange : https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}\n\nL'equipe Qlower`,
  },
];

export default function CampagnesTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const [audience, setAudience] = useState<Audience>("tous");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sentPartners, setSentPartners] = useState<Set<string>>(new Set());
  const [allSent, setAllSent] = useState(false);

  const targeted = partners.filter((p) => {
    if (!p.active) return false;
    if (audience === "tous") return true;
    return p.contrat === (audience as ContratType);
  });

  const template = TEMPLATES.find((t) => t.key === selectedTemplate);
  const previewPartner = targeted[0];

  const handleSendAll = () => {
    const ids = new Set(targeted.map((p) => p.id));
    setSentPartners(ids);
    setAllSent(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement des campagnes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ciblage */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-[#0A3855]" />
              Ciblage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Select
              label="Audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setAllSent(false);
                setSentPartners(new Set());
              }}
              options={[
                { value: "tous", label: "Tous les partenaires actifs" },
                { value: "affiliation", label: "Affiliation uniquement" },
                { value: "marque_blanche", label: "Marque blanche uniquement" },
              ]}
            />
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {targeted.length} partenaire(s) cible(s)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {targeted.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className={
                      sentPartners.has(p.id)
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10"
                    }
                  >
                    {sentPartners.has(p.id) && (
                      <CheckCircle2 className="size-3 mr-0.5" />
                    )}
                    {p.nom}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#0A3855]" />
              Template
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setSelectedTemplate(t.key);
                    setShowPreview(false);
                    setAllSent(false);
                    setSentPartners(new Set());
                  }}
                  className={`text-left p-3.5 rounded-lg border-2 transition-all ${
                    selectedTemplate === t.key
                      ? "border-[#0A3855] bg-[#E5EDF1]/30 ring-1 ring-[#0A3855]/10"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className={`size-3.5 ${selectedTemplate === t.key ? "text-[#0A3855]" : "text-gray-400"}`} />
                    <p className={`text-sm font-medium ${selectedTemplate === t.key ? "text-[#0A3855]" : "text-gray-900"}`}>
                      {t.title}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 ml-5.5">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview & Send */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4 text-[#0A3855]" />
            Previsualisation et envoi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {!selectedTemplate ? (
            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                Selectionnez un template pour previsualiser.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={!previewPartner}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="size-4 mr-1.5" />
                      Masquer apercu
                    </>
                  ) : (
                    <>
                      <Eye className="size-4 mr-1.5" />
                      Previsualiser
                    </>
                  )}
                </Button>
                <Button
                  className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                  onClick={handleSendAll}
                  disabled={targeted.length === 0 || allSent}
                >
                  {allSent ? (
                    <>
                      <CheckCircle2 className="size-4 mr-1.5" />
                      Envoye a {targeted.length} partenaire(s)
                    </>
                  ) : (
                    <>
                      <Send className="size-4 mr-1.5" />
                      Envoyer a {targeted.length} partenaire(s)
                    </>
                  )}
                </Button>
              </div>

              {/* Preview */}
              {showPreview && template && previewPartner && (
                <Card className="bg-[#F8FAFB] border-dashed">
                  <CardContent>
                    <p className="text-xs text-gray-400 mb-2">
                      Apercu pour : {previewPartner.nom}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Objet : {template.subject(previewPartner)}
                    </p>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded-lg border border-gray-200 p-4">
                      {template.body(previewPartner)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Per-partner status */}
              <div className="space-y-2">
                {targeted.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <span className="text-sm text-gray-700 font-medium">{p.nom}</span>
                    <div className="flex items-center gap-3">
                      {template && (
                        <button
                          onClick={() => setShowPreview(true)}
                          className="flex items-center gap-1 text-xs text-[#0A3855] hover:underline"
                        >
                          <Eye className="size-3" />
                          Apercu
                        </button>
                      )}
                      {sentPartners.has(p.id) ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          <CheckCircle2 className="size-3 mr-0.5" />
                          Envoye
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-gray-50 text-gray-500 border border-gray-200"
                        >
                          <Clock className="size-3 mr-0.5" />
                          En attente
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
