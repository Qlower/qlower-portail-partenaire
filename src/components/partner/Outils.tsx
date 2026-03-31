"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Partner } from "@/types";

type Tab = "kit" | "agenda" | "faq";

interface OutilsProps {
  partner: Partner;
}

const FISCAL_CALENDAR = [
  { date: "Janvier", label: "Bilan N-1 : clôture des comptes", urgency: "amber" as const },
  { date: "Février", label: "Réception des IFU et relevés bancaires", urgency: "blue" as const },
  { date: "Mars", label: "Ouverture déclarations revenus fonciers", urgency: "amber" as const },
  { date: "Avril", label: "Ouverture déclaration IR (formulaire 2042)", urgency: "red" as const },
  { date: "Mai", label: "Date limite zone 1 (départements 01-19)", urgency: "red" as const },
  { date: "Juin", label: "Date limite zones 2 et 3", urgency: "red" as const },
  { date: "Juillet", label: "Avis d'imposition disponible", urgency: "blue" as const },
  { date: "Septembre", label: "Paiement solde IR si applicable", urgency: "amber" as const },
  { date: "Octobre", label: "Déclaration CFE pour nouveaux biens", urgency: "blue" as const },
  { date: "Décembre", label: "Anticipation bilan N : provisions, amortissements", urgency: "blue" as const },
];

const FAQ_ITEMS = [
  {
    q: "Comment sont calculées mes commissions ?",
    a: "Votre commission est fixe : 100 € par client abonné qui souscrit à Qlower via votre lien ou formulaire. Elle est versée annuellement, pour chaque client abonné actif sur l'année.",
  },
  {
    q: "Quand suis-je payé ?",
    a: "Les commissions sont versées annuellement par virement sur le RIB fourni lors de votre inscription. Un récapitulatif vous est envoyé par email avant chaque versement.",
  },
  {
    q: "Comment suivre mes contacts ?",
    a: "Rendez-vous dans l'onglet 'Recommander' pour voir l'historique complet de vos contacts et leur statut (inscrit, abonné, payeur). Note : si un contact envoyé n'apparaît pas, contactez votre responsable partenariat pour vérification.",
  },
  {
    q: "Puis-je personnaliser mon lien d'inscription ?",
    a: "Votre lien contient déjà votre code partenaire et vos paramètres de suivi. Il n'est pas recommandé de le modifier manuellement sous peine de perdre l'attribution de vos leads.",
  },
  {
    q: "Un de mes contacts a un problème technique, que faire ?",
    a: "Orientez-le vers le support Qlower via le chat intégré dans l'application, ou contactez directement votre interlocutrice partenariat qui pourra escalader la demande.",
  },
  {
    q: "Comment fonctionne le programme de parrainage ?",
    a: "Vous recevez 100 € de commission fixe pour chaque client abonné qui souscrit à Qlower via votre lien ou formulaire de recommandation. Le suivi est visible dans votre tableau de bord.",
  },
  {
    q: "Est-il possible de passer en marque blanche ?",
    a: "Oui. À partir de 50 clients apportés annuellement, nous pouvons étudier ensemble une formule en marque blanche (votre logo, vos couleurs, votre domaine). Contactez votre responsable partenariat pour en discuter.",
  },
];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  kit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  agenda: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  faq: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function Outils({ partner }: OutilsProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("kit");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "kit", label: "Mon kit" },
    { key: "agenda", label: "Agenda fiscal" },
    { key: "faq", label: "FAQ" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boîte à outils"
        subtitle="Ressources, calendrier fiscal et FAQ"
      />

      {/* Pill-style tab bar */}
      <div className="inline-flex gap-1 bg-[#E5EDF1]/60 rounded-xl p-1 border border-gray-200/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              tab === t.key
                ? "bg-white text-[#0A3855] shadow-sm border border-gray-200/80"
                : "text-gray-500 hover:text-[#0A3855] hover:bg-white/50 border border-transparent"
            }`}
          >
            <span className={tab === t.key ? "text-[#0A3855]" : "text-gray-400"}>
              {TAB_ICONS[t.key]}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Kit tab */}
      {tab === "kit" && (
        <div className="space-y-4">
          <button
            onClick={() => router.push("/dashboard/kit")}
            className="group w-full flex items-center justify-between p-5 bg-gradient-to-r from-[#0A3855] to-[#0A3855]/80 rounded-xl text-white hover:from-[#0c4a6e] hover:to-[#0c4a6e]/80 transition-all duration-200 shadow-md shadow-[#0A3855]/20 cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Kit partenaire complet</p>
                <p className="text-xs text-white/60">Logos, guides, templates, prise de RDV</p>
                <p className="text-xs text-[#F6CCA4] font-medium mt-1">Accéder au kit →</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#F6CCA4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Code promo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative overflow-hidden bg-gradient-to-r from-[#FFF5ED] to-[#FFF5ED]/50 border border-[#F6CCA4]/30 rounded-xl px-5 py-4">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-[#F6CCA4]/10 rounded-full -translate-y-10 translate-x-10" />
                  <p className="text-[11px] text-[#0A3855]/50 font-semibold uppercase tracking-wider mb-1">Votre code</p>
                  <p className="text-2xl font-bold text-[#0A3855] tracking-[0.15em] font-mono">
                    {partner.code}
                  </p>
                </div>
                <CopyButton text={partner.code} label="Copier" />
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Agenda tab */}
      {tab === "agenda" && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900">
              Calendrier fiscal immobilier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {FISCAL_CALENDAR.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-3.5 border-b border-gray-100 last:border-0 group hover:bg-[#E5EDF1]/20 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="w-24 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="bg-white text-gray-700 border-gray-200 text-xs font-semibold shadow-none px-2.5"
                    >
                      {item.date}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.label}</p>
                  </div>
                  <Badge
                    variant={item.urgency === "red" ? "destructive" : "secondary"}
                    className={`text-[10px] font-semibold shadow-none whitespace-nowrap ${
                      item.urgency === "red"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : item.urgency === "amber"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {item.urgency === "red" ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Urgent
                      </span>
                    ) : item.urgency === "amber" ? (
                      "Important"
                    ) : (
                      "Info"
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ tab */}
      {tab === "faq" && (
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`bg-white rounded-xl border transition-all duration-200 ${
                openFaq === i
                  ? "border-[#0A3855]/20 shadow-md ring-1 ring-[#0A3855]/5"
                  : "border-gray-200 shadow-sm hover:border-gray-300"
              }`}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left group"
              >
                <span className={`text-sm font-medium pr-4 transition-colors ${
                  openFaq === i ? "text-[#0A3855]" : "text-gray-900 group-hover:text-[#0A3855]"
                }`}>
                  {item.q}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  openFaq === i
                    ? "bg-[#0A3855] text-white rotate-180"
                    : "bg-[#E5EDF1] text-[#0A3855]/60 group-hover:bg-[#0A3855]/10"
                }`}>
                  <svg
                    className="w-4 h-4 transition-transform duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openFaq === i ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-5 pb-5">
                  <Separator className="mb-3" />
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
