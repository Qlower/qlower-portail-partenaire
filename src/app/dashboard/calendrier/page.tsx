"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Sparkles, BookOpen, Lightbulb, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { CALENDRIER, DISPOSITIFS_2026, URGENCE_LABEL, type MoisFiscal, type Urgence } from "@/data/calendrier-fiscal";

/**
 * Calendrier fiscal 2026-2027 — page interne destinée aux partenaires.
 *
 * Source : sheet "CALENDRIER FISCAL - BtoB 2026 2027" (Coline Sinquin).
 * Remplace le PDF Google Drive qui était pointé depuis /dashboard/kit.
 *
 * Le partenaire peut consulter / copier le contenu pour le retransmettre
 * à ses clients. La page est volontairement riche : intro, à savoir,
 * bonnes pratiques, nouveautés fiscales par mois.
 */
export default function CalendrierPage() {
  const [openSlug, setOpenSlug] = useState<string | null>(CALENDRIER[0]?.slug || null);
  const [activeYear, setActiveYear] = useState<2026 | 2027>(2026);

  const moisAffichee = useMemo(
    () => CALENDRIER.filter((m) => m.annee === activeYear),
    [activeYear],
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/dashboard/kit"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]"
      >
        <ArrowLeft className="w-3 h-3" /> Retour à la boîte à outils
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-[#FFF5ED] to-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[#F6CCA4] p-2 shrink-0">
            <CalendarIcon className="w-5 h-5 text-[#0A3855]" />
          </div>
          <div>
            <div className="text-[11px] font-medium tracking-wider uppercase text-gray-500 mb-1">
              Qlower — Programme partenaire
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0A3855] leading-tight">
              Calendrier fiscal 2026 — 2027
            </h1>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              Toutes les échéances clés à transmettre à vos clients investisseurs immobiliers.
              Régimes concernés (LMNP, foncier, SCI, IFI), nouveautés de la Loi de finances 2026
              et bonnes pratiques mois par mois.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
              <span className="rounded-full bg-white border border-gray-200 px-2.5 py-1 text-gray-600">
                Loi de finances 2026 (n°2026-103 du 19 février 2026)
              </span>
              <span className="rounded-full bg-white border border-gray-200 px-2.5 py-1 text-gray-600">
                Dispositif Jeanbrun (Relance Logement)
              </span>
              <span className="rounded-full bg-white border border-gray-200 px-2.5 py-1 text-gray-600">
                Nouvelle TVLH
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Year switch */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveYear(2026)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeYear === 2026
              ? "bg-[#0A3855] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          2026
        </button>
        <button
          type="button"
          onClick={() => setActiveYear(2027)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeYear === 2027
              ? "bg-[#0A3855] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          2027 (1er semestre)
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-600">
        {(["prioritaire", "important", "modere", "planification"] as Urgence[]).map((u) => (
          <span key={u} className="inline-flex items-center gap-1">
            <span>{URGENCE_LABEL[u].emoji}</span>
            <span>{URGENCE_LABEL[u].label}</span>
          </span>
        ))}
      </div>

      {/* Liste des mois */}
      <div className="space-y-3">
        {moisAffichee.map((mois) => (
          <MoisCard
            key={mois.slug}
            mois={mois}
            isOpen={openSlug === mois.slug}
            onToggle={() => setOpenSlug(openSlug === mois.slug ? null : mois.slug)}
          />
        ))}
      </div>

      {/* Tableau récapitulatif des dispositifs */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#0A3855]">
            Dispositifs fiscaux 2026 — récapitulatif
          </h2>
          <span className="text-xs text-gray-500">à transmettre tel quel à vos clients</span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-medium tracking-wider uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2.5 text-left">Dispositif / Régime</th>
                  <th className="px-3 py-2.5 text-left">Type de location</th>
                  <th className="px-3 py-2.5 text-left">Avantage fiscal</th>
                  <th className="px-3 py-2.5 text-left">Plafond annuel</th>
                  <th className="px-3 py-2.5 text-left">Conditions principales</th>
                </tr>
              </thead>
              <tbody>
                {DISPOSITIFS_2026.map((d, idx) => (
                  <tr key={d.nom} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                    <td className="px-3 py-3 font-medium text-[#0A3855] align-top">
                      <div className="flex items-start gap-1.5">
                        {d.isNouveau && (
                          <Sparkles className="w-3.5 h-3.5 text-[#F6CCA4] mt-0.5 shrink-0" />
                        )}
                        <span>{d.nom}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 align-top">{d.type}</td>
                    <td className="px-3 py-3 text-gray-700 align-top whitespace-pre-line">
                      {d.avantage}
                    </td>
                    <td className="px-3 py-3 text-gray-700 align-top whitespace-pre-line">
                      {d.plafond}
                    </td>
                    <td className="px-3 py-3 text-gray-600 align-top">
                      <ul className="space-y-0.5">
                        {d.conditions.map((c, i) => (
                          <li key={i} className="text-xs">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 pt-2 pb-6">
        Sources : Loi de finances 2026 (n°2026-103 du 19 février 2026), DGFiP, ANAH.
        Document produit par Qlower à destination de ses partenaires affiliés et marque blanche.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sous-composants
// ----------------------------------------------------------------------------

function MoisCard({
  mois,
  isOpen,
  onToggle,
}: {
  mois: MoisFiscal;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const u = URGENCE_LABEL[mois.urgence];
  return (
    <div className={`rounded-xl border ${u.border} bg-white overflow-hidden transition-shadow ${isOpen ? "shadow-md" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left px-4 sm:px-5 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className={`rounded-lg ${u.bg} ${u.text} px-2.5 py-1.5 text-xs font-semibold shrink-0 inline-flex items-center gap-1`}>
          <span>{u.emoji}</span>
          <span>{u.label}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#0A3855]">{mois.mois}</span>
            <span className="text-sm text-gray-700">— {mois.themePrincipal}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-gray-500">
            <span className="whitespace-pre-line">📅 {mois.datesCles}</span>
          </div>
          <div className="text-[12px] text-gray-500 mt-1">
            <span className="text-gray-400">Régimes :</span> {mois.regimes}
          </div>
        </div>
        <div className="shrink-0 text-gray-400 mt-1">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 p-4 sm:p-5 space-y-5 bg-gradient-to-b from-gray-50/40 to-white">
          {/* Intro */}
          <Section icon={<BookOpen className="w-4 h-4" />} label="Introduction" color="blue">
            <p className="text-sm text-gray-700 leading-relaxed">{mois.intro}</p>
          </Section>

          {/* À savoir */}
          {mois.aSavoir && mois.aSavoir.length > 0 && (
            <Section icon={<AlertCircle className="w-4 h-4" />} label="À savoir" color="amber">
              <ul className="space-y-1.5">
                {mois.aSavoir.map((point, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-amber-600 shrink-0 mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Bonnes pratiques */}
          <Section icon={<Lightbulb className="w-4 h-4" />} label="Bonnes pratiques" color="green">
            <ul className="space-y-1.5">
              {mois.bonnesPratiques.map((point, i) => (
                <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                  <span className="text-green-600 shrink-0 mt-0.5">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Nouveautés */}
          {mois.nouveautes && mois.nouveautes.length > 0 && (
            <Section icon={<Sparkles className="w-4 h-4" />} label="Nouveautés fiscales 2026" color="orange">
              <ul className="space-y-1.5">
                {mois.nouveautes.map((point, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-orange-500 shrink-0 mt-0.5">★</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: "blue" | "amber" | "green" | "orange";
  children: React.ReactNode;
}) {
  // Le bandeau-icône reste coloré pour identifier la section au coup d'œil,
  // mais le LABEL devient un vrai H2 navy gros — comme le titre "Dispositifs
  // fiscaux 2026" plus bas. Plus lisible et sémantiquement correct.
  const iconBg = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`inline-flex items-center justify-center rounded-md ${iconBg[color]} p-1.5`}>
          {icon}
        </div>
        <h2 className="text-base font-semibold text-[#0A3855]">{label}</h2>
      </div>
      {children}
    </div>
  );
}
