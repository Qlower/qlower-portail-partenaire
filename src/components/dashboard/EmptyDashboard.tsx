"use client";

import { Card, CardContent, Button, CopyButton } from "@/components/ui";
import { buildSignupLink } from "@/services/links";
import { BENCHMARK } from "@/services/constants";

interface EmptyDashboardProps {
  code: string;
  utm: string;
  onNavigate: (module: string) => void;
}

export function EmptyDashboard({ code, utm, onNavigate }: EmptyDashboardProps) {
  const signupLink = buildSignupLink(utm, code);
  const benchmark = BENCHMARK[code] || BENCHMARK.default;

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      {/* Empty State Card */}
      <Card className="border-0 shadow-xl shadow-[#0A3855]/5 overflow-visible">
        <CardContent className="text-center py-10 px-6 sm:px-10">
          {/* Illustration-style icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#E5EDF1] to-[#E5EDF1]/40" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white to-[#E5EDF1]/60 flex items-center justify-center shadow-inner">
              <svg className="w-10 h-10 text-[#0A3855]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Vous n&apos;avez pas encore de leads
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
            Partagez votre lien d&apos;inscription a vos contacts pour commencer a suivre vos
            referrals et generer des commissions.
          </p>

          {/* Signup link */}
          <div className="bg-[#E5EDF1]/50 border border-[#E5EDF1] rounded-xl p-5 mb-8">
            <p className="text-[11px] text-[#0A3855]/50 mb-3 font-semibold uppercase tracking-widest">
              Votre lien d&apos;inscription
            </p>
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <code className="text-xs bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-[#0A3855]/70 break-all max-w-sm shadow-sm">
                {signupLink}
              </code>
              <CopyButton text={signupLink} label="Copier le lien" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={() => onNavigate("referer")} className="px-6">
              Referer un contact
            </Button>
            <Button variant="outline" onClick={() => onNavigate("outils")} className="px-6">
              Voir les outils
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Section */}
      <Card className="mt-6 border-0 shadow-md shadow-[#0A3855]/5">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#FFF5ED] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#F6CCA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                Benchmark de conversion
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                Les {benchmark.label} obtiennent en moyenne un taux de conversion de{" "}
                <span className="font-bold text-[#0A3855]">{benchmark.taux}%</span> de
                leads en abonnes payants.
              </p>
              {/* Progress bar visual */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#E5EDF1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#0A3855] to-[#0A3855]/70 rounded-full transition-all duration-700"
                    style={{ width: `${benchmark.taux}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#0A3855] tabular-nums">{benchmark.taux}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
