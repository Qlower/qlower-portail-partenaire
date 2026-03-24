"use client";

import { Card, Button, CopyButton } from "@/components/ui";
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
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Empty State Card */}
      <Card className="text-center" padding="lg">
        <div className="text-6xl mb-4">&#x1F4ED;</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Vous n&apos;avez pas encore de leads
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
          Partagez votre lien d&apos;inscription a vos contacts pour commencer a suivre vos
          referrals et generer des commissions.
        </p>

        {/* Signup link */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Votre lien d&apos;inscription
          </p>
          <div className="flex items-center gap-2 justify-center flex-wrap">
            <code className="text-xs bg-white border border-gray-200 rounded-md px-3 py-2 text-gray-600 break-all max-w-sm">
              {signupLink}
            </code>
            <CopyButton text={signupLink} label="Copier le lien" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="primary" onClick={() => onNavigate("referer")}>
            Referer un contact
          </Button>
          <Button variant="outline" onClick={() => onNavigate("outils")}>
            Voir les outils
          </Button>
        </div>
      </Card>

      {/* Benchmark Section */}
      <Card className="mt-6" padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">&#x1F4CA;</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Benchmark de conversion
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Les {benchmark.label} obtiennent en moyenne un taux de conversion de{" "}
              <span className="font-bold text-[#0A3855]">{benchmark.taux}%</span> de
              leads en abonnes payants. Partagez votre lien pour commencer !
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
