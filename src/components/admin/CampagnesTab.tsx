"use client";

import { useState, useEffect } from "react";
import type { Partner, ContratType } from "@/types";
import { api } from "@/lib/axios";
import { Card, Button, Select, Badge, Alert } from "@/components/ui";

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
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState<Audience>("tous");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sentPartners, setSentPartners] = useState<Set<string>>(new Set());
  const [allSent, setAllSent] = useState(false);

  useEffect(() => {
    api
      .get("/admin/partners")
      .then((res) => setPartners(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ciblage */}
        <Card>
          <h4 className="font-semibold text-gray-900 mb-3">Ciblage</h4>
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
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">
              {targeted.length} partenaire(s) cible(s)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {targeted.map((p) => (
                <Badge key={p.id} variant={sentPartners.has(p.id) ? "green" : "blue"}>
                  {p.nom}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Template */}
        <Card>
          <h4 className="font-semibold text-gray-900 mb-3">Template</h4>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setSelectedTemplate(t.key);
                  setShowPreview(false);
                  setAllSent(false);
                  setSentPartners(new Set());
                }}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  selectedTemplate === t.key
                    ? "border-[#0A3855] bg-blue-50/50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Preview & Send */}
      <Card>
        <h4 className="font-semibold text-gray-900 mb-3">Previsualisation et envoi</h4>

        {!selectedTemplate ? (
          <Alert type="info">Selectionnez un template pour previsualiser.</Alert>
        ) : (
          <>
            <div className="flex gap-3 mb-4">
              <Button
                variant="secondary"
                onClick={() => setShowPreview(!showPreview)}
                disabled={!previewPartner}
              >
                {showPreview ? "Masquer apercu" : "Previsualiser"}
              </Button>
              <Button
                variant="accent"
                onClick={handleSendAll}
                disabled={targeted.length === 0 || allSent}
              >
                {allSent
                  ? `Envoye a ${targeted.length} partenaire(s)`
                  : `Envoyer a ${targeted.length} partenaire(s)`}
              </Button>
            </div>

            {/* Preview */}
            {showPreview && template && previewPartner && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-400 mb-1">Apercu pour : {previewPartner.nom}</p>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Objet : {template.subject(previewPartner)}
                </p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {template.body(previewPartner)}
                </pre>
              </div>
            )}

            {/* Per-partner status */}
            <div className="space-y-1.5">
              {targeted.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded bg-white border border-gray-100"
                >
                  <span className="text-sm text-gray-700">{p.nom}</span>
                  <div className="flex items-center gap-2">
                    {template && (
                      <button
                        onClick={() => setShowPreview(true)}
                        className="text-xs text-[#0A3855] hover:underline"
                      >
                        Apercu
                      </button>
                    )}
                    {sentPartners.has(p.id) ? (
                      <Badge variant="green">Envoye</Badge>
                    ) : (
                      <Badge variant="gray">En attente</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
