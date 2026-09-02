"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Partner } from "@/types";

interface Campaign {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso?.slice(0, 10) || "";
  }
}

export default function Communications({ partner }: { partner: Partner }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["partner-campaigns", partner.id],
    queryFn: async () => {
      const res = await fetch(`/api/partner/campaigns?partner_id=${partner.id}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.campaigns || [];
    },
    enabled: !!partner.id,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Communications reçues"
        subtitle="L'historique des emails que l'équipe Qlower vous a envoyés."
      />

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>
      ) : campaigns.length === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E5EDF1] flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-[#0A3855]" />
            </div>
            <p className="text-sm font-medium text-gray-700">Aucune communication pour le moment</p>
            <p className="text-xs text-gray-400 mt-1">
              Les emails envoyés par l&apos;équipe Qlower apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c) => {
            const open = openId === c.id;
            return (
              <Card key={c.id} className="border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E5EDF1] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4.5 h-4.5 text-[#0A3855]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{c.subject || "(sans objet)"}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{fmtDate(c.sent_at)}</div>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                    <div
                      className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed [&_a]:text-[#0A3855] [&_a]:underline whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: c.body }}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
