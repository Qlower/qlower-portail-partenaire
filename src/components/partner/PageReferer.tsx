"use client";

import { useState, type ReactElement } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePartner, useReferrals } from "@/hooks/usePartnerData";
import { buildSignupLink, buildRdvLink } from "@/services/links";
import { STAGE_STYLES } from "@/services/constants";
import { PageHeader, Card, CopyButton, Badge } from "@/components/ui";
import ReferralForm from "./ReferralForm";
import type { Partner } from "@/types";

type Mode = "link" | "form" | "rdv";

interface PageRefererProps {
  partner: Partner;
}

export default function PageReferer({ partner }: PageRefererProps) {
  const { data: referrals, isLoading: referralsLoading } = useReferrals(partner.id);
  const [mode, setMode] = useState<Mode>("link");

  const signupLink = buildSignupLink(partner.utm, partner.code);
  const rdvLink = buildRdvLink(partner.utm);

  const modes: { key: Mode; icon: ReactElement; title: string; desc: string }[] = [
    {
      key: "link",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      title: "Lien direct",
      desc: "Partagez votre lien d'inscription",
    },
    {
      key: "form",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Formulaire",
      desc: "Saisissez les infos du contact",
    },
    {
      key: "rdv",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      title: "Lien RDV",
      desc: "Partagez un lien de prise de RDV",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Referer un contact"
        subtitle="Partagez Qlower et generez des commissions"
      />

      {/* Mode selector cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200 ${
              mode === m.key
                ? "border-[#0A3855] bg-[#0A3855]/5 shadow-sm"
                : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                mode === m.key
                  ? "bg-[#0A3855] text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {m.icon}
            </div>
            <span
              className={`text-sm font-semibold ${
                mode === m.key ? "text-[#0A3855]" : "text-gray-700"
              }`}
            >
              {m.title}
            </span>
            <span className="text-[11px] text-gray-400 leading-tight">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Active content */}
      <div className="mb-6">
        {mode === "link" && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Votre lien d&apos;inscription personnalise
            </h3>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2.5">
                {signupLink}
              </span>
              <CopyButton text={signupLink} />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Chaque inscription via ce lien sera automatiquement track&eacute;e et attribu&eacute;e &agrave; votre compte partenaire.
            </p>
          </Card>
        )}

        {mode === "form" && <ReferralForm partner={partner} />}

        {mode === "rdv" && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Votre lien de rendez-vous
            </h3>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2.5">
                {rdvLink}
              </span>
              <CopyButton text={rdvLink} />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Vos contacts peuvent r&eacute;server un cr&eacute;neau directement avec l&apos;&eacute;quipe Qlower.
            </p>
          </Card>
        )}
      </div>

      {/* Referral history */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Historique des referrals
        </h3>

        {referralsLoading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">Chargement...</p>
          </div>
        ) : !referrals || referrals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Aucun referral pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Contact</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Statut</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const stageStyle = STAGE_STYLES[r.statut] || { text: "text-gray-600", bg: "bg-gray-100" };
                  return (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {r.prenom} {r.nom}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{r.email}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageStyle.bg} ${stageStyle.text}`}>
                          {r.statut}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
