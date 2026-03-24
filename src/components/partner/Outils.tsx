"use client";

import { useState } from "react";
import { buildSignupLink } from "@/services/links";
import { PageHeader, Card, CopyButton, Badge } from "@/components/ui";
import type { Partner } from "@/types";

type Tab = "kit" | "agenda" | "faq";

interface OutilsProps {
  partner: Partner;
}

const FISCAL_CALENDAR = [
  { date: "Janvier", label: "Bilan N-1 : cloture des comptes", urgency: "amber" as const },
  { date: "Fevrier", label: "Reception des IFU et releves bancaires", urgency: "blue" as const },
  { date: "Mars", label: "Ouverture declarations revenus fonciers", urgency: "amber" as const },
  { date: "Avril", label: "Ouverture declaration IR (formulaire 2042)", urgency: "red" as const },
  { date: "Mai", label: "Date limite zone 1 (departements 01-19)", urgency: "red" as const },
  { date: "Juin", label: "Date limite zone 2 et 3", urgency: "red" as const },
  { date: "Juillet", label: "Avis d'imposition disponible", urgency: "blue" as const },
  { date: "Septembre", label: "Paiement solde IR si applicable", urgency: "amber" as const },
  { date: "Octobre", label: "Declaration CFE pour nouveaux biens", urgency: "blue" as const },
  { date: "Decembre", label: "Anticipation bilan N : provisions, amortissements", urgency: "blue" as const },
];

const FAQ_ITEMS = [
  {
    q: "Comment sont calculees mes commissions ?",
    a: "Vos commissions dependent de votre contrat partenaire. Elles peuvent inclure un fixe a la souscription, une commission annuelle recurrente, un variable selon le nombre de biens du client, ou un pourcentage du chiffre d'affaires genere.",
  },
  {
    q: "Quand suis-je paye ?",
    a: "Les commissions sont versees trimestriellement par virement sur le RIB que vous avez fourni lors de votre inscription. Un recapitulatif vous est envoye par email avant chaque versement.",
  },
  {
    q: "Comment suivre mes referrals ?",
    a: "Rendez-vous dans l'onglet 'Referer' pour voir l'historique complet de vos contacts et leur statut (inscrit, abonne, payeur). Chaque changement de statut est synchronise automatiquement.",
  },
  {
    q: "Puis-je personnaliser mon lien d'inscription ?",
    a: "Votre lien contient deja votre UTM et code promo personnalises. Pour une offre marque blanche avec votre logo et couleurs, contactez votre responsable partenariat.",
  },
  {
    q: "Un de mes contacts a un probleme technique, que faire ?",
    a: "Orientez-le vers le support Qlower via le chat integre dans l'application, ou contactez directement votre interlocutrice partenariat qui pourra escalader la demande.",
  },
  {
    q: "Comment fonctionne le programme de parrainage ?",
    a: "Vous recevez une commission pour chaque client qui souscrit a un abonnement Qlower via votre lien ou formulaire de referral. Le suivi est automatique grace a l'UTM tracking et la synchronisation HubSpot.",
  },
];

export default function Outils({ partner }: OutilsProps) {
  const [tab, setTab] = useState<Tab>("kit");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const signupLink = buildSignupLink(partner.utm, partner.code);

  const tabs: { key: Tab; label: string }[] = [
    { key: "kit", label: "Mon kit" },
    { key: "agenda", label: "Agenda fiscal" },
    { key: "faq", label: "FAQ" },
  ];

  return (
    <div>
      <PageHeader
        title="Boite a outils"
        subtitle="Ressources, calendrier fiscal et FAQ"
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Kit tab */}
      {tab === "kit" && (
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Lien d&apos;inscription
            </h3>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2.5">
                {signupLink}
              </span>
              <CopyButton text={signupLink} />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Code promo
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gradient-to-r from-[#0A3855]/5 to-[#1a5a7a]/5 border border-[#0A3855]/10 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">Votre code</p>
                <p className="text-lg font-bold text-[#0A3855] tracking-wider">
                  {partner.code}
                </p>
              </div>
              <CopyButton text={partner.code} label="Copier" />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              UTM de tracking
            </h3>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2.5 font-mono">
                {partner.utm}
              </span>
              <CopyButton text={partner.utm} />
            </div>
          </Card>
        </div>
      )}

      {/* Agenda tab */}
      {tab === "agenda" && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Calendrier fiscal immobilier
          </h3>
          <div className="flex flex-col gap-3">
            {FISCAL_CALENDAR.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0"
              >
                <div className="w-24 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">
                    {item.date}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{item.label}</p>
                </div>
                <Badge
                  variant={item.urgency}
                >
                  {item.urgency === "red"
                    ? "Urgent"
                    : item.urgency === "amber"
                      ? "Important"
                      : "Info"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FAQ tab */}
      {tab === "faq" && (
        <div className="flex flex-col gap-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-gray-900 pr-4">
                  {item.q}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openFaq === i ? "max-h-48" : "max-h-0"
                }`}
              >
                <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
