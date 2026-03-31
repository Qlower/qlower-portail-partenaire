"use client";

import { useState, type ReactElement } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePartner, useReferrals } from "@/hooks/usePartnerData";
import { buildSignupLink, buildRdvLink } from "@/services/links";
import { STAGE_STYLES } from "@/services/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-6">
      <PageHeader
        title="Recommander Qlower"
        subtitle="Partagez Qlower et générez des commissions"
      />

      {/* Mode selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all duration-200 cursor-pointer ${
              mode === m.key
                ? "border-[#0A3855] bg-[#E5EDF1]/60 shadow-md ring-1 ring-[#0A3855]/10"
                : "border-gray-200 bg-white hover:border-[#0A3855]/30 hover:bg-[#E5EDF1]/20 hover:shadow-sm"
            }`}
          >
            {/* Active indicator dot */}
            {mode === m.key && (
              <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#0A3855] shadow-sm" />
            )}
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                mode === m.key
                  ? "bg-[#0A3855] text-white shadow-lg shadow-[#0A3855]/25"
                  : "bg-[#E5EDF1] text-[#0A3855]/60 group-hover:bg-[#0A3855]/10 group-hover:text-[#0A3855]"
              }`}
            >
              {m.icon}
            </div>
            <div>
              <span
                className={`block text-sm font-semibold transition-colors ${
                  mode === m.key ? "text-[#0A3855]" : "text-gray-800"
                }`}
              >
                {m.title}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5 leading-tight">{m.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Active content */}
      <div>
        {mode === "link" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">
                Votre lien d&apos;inscription personnalise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <code className="block truncate text-sm text-[#0A3855] bg-[#E5EDF1]/50 rounded-lg border border-[#0A3855]/10 px-4 py-3 font-mono">
                    {signupLink}
                  </code>
                </div>
                <CopyButton text={signupLink} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Chaque inscription via ce lien sera automatiquement track&eacute;e et attribu&eacute;e &agrave; votre compte partenaire.
              </p>
            </CardContent>
          </Card>
        )}

        {mode === "form" && <ReferralForm partner={partner} />}

        {mode === "rdv" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">
                Votre lien de rendez-vous
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <code className="block truncate text-sm text-[#0A3855] bg-[#E5EDF1]/50 rounded-lg border border-[#0A3855]/10 px-4 py-3 font-mono">
                    {rdvLink}
                  </code>
                </div>
                <CopyButton text={rdvLink} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Vos contacts peuvent r&eacute;server un cr&eacute;neau directement avec l&apos;&eacute;quipe Qlower.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Referral history */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-900">
              Historique des referrals
            </CardTitle>
            {referrals && referrals.length > 0 && (
              <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-xs">
                {referrals.length} contact{referrals.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {referralsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 mt-3">Chargement...</p>
            </div>
          ) : !referrals || referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-[#E5EDF1] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#0A3855]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Aucun referral pour le moment</p>
              <p className="text-xs text-gray-400 mt-1">Vos contacts appara&icirc;tront ici une fois envoy&eacute;s</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Contact</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Email</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Statut</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {referrals.map((r) => {
                    const stageStyle = STAGE_STYLES[r.statut] || { text: "text-gray-600", bg: "bg-gray-100" };
                    return (
                      <tr key={r.id} className="hover:bg-[#E5EDF1]/20 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-gray-900">
                          {r.prenom} {r.nom}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500">{r.email}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stageStyle.bg} ${stageStyle.text}`}>
                            {r.statut}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-400 tabular-nums">
                          {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
