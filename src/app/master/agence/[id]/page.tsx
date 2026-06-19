"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, Euro, UserPlus } from "lucide-react";

interface Detail {
  agency: { id: string; nom: string; code: string };
  totals: { bailleurs: number; leads: number; ca: number };
  months: { month: string; leads: number; bailleurs: number }[];
}

const fmtEUR = (n: number) => Math.round(n).toLocaleString("fr-FR");
const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  const names = ["", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${names[parseInt(mo, 10)] ?? mo} ${y}`;
};

export default function MasterAgencyPage() {
  const params = useParams();
  const id = String(params.id);
  const network = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("network") : null;
  const qs = network ? `?network=${encodeURIComponent(network)}` : "";
  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ["master-agency", id, network],
    queryFn: async () => {
      const res = await fetch(`/api/master/agency/${id}${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement de l&apos;agence…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-16 p-6 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm">
        {error instanceof Error ? error.message : "Accès refusé."}
      </div>
    );
  }

  const maxMonth = Math.max(1, ...data.months.map((m) => m.leads));

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
      <Link href={`/master${qs}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="size-3.5" /> Retour au consolidé
      </Link>

      <div>
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold">Détail agence (anonymisé)</p>
        <h1 className="text-2xl font-bold text-[#0A3855]">{data.agency.nom}</h1>
        <p className="text-xs text-gray-400 font-mono">{data.agency.code}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E5EDF1] flex items-center justify-center"><Users className="size-4 text-[#0A3855]" /></div>
            <div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Bailleurs</p><p className="text-xl font-bold text-[#0A3855] tabular-nums">{data.totals.bailleurs}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFF5ED] flex items-center justify-center"><UserPlus className="size-4 text-[#B8864E]" /></div>
            <div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Contacts</p><p className="text-xl font-bold text-gray-900 tabular-nums">{data.totals.leads}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><Euro className="size-4 text-emerald-600" /></div>
            <div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">CA généré</p><p className="text-xl font-bold text-gray-900 tabular-nums">{fmtEUR(data.totals.ca)} €</p></div>
          </div>
        </CardContent></Card>
      </div>

      <Card><CardContent>
        <h2 className="text-sm font-semibold text-[#0A3855] mb-3">Évolution mensuelle</h2>
        {data.months.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Aucune activité enregistrée pour cette agence.</p>
        ) : (
          <div className="space-y-1.5">
            {data.months.map((m) => (
              <div key={m.month} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-gray-500">{fmtMonth(m.month)}</span>
                <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                  <div className="h-full bg-[#0A3855]/70 rounded" style={{ width: `${(m.leads / maxMonth) * 100}%` }} />
                </div>
                <span className="tabular-nums text-gray-600 w-28 text-right">{m.leads} contact{m.leads > 1 ? "s" : ""} · {m.bailleurs} bailleur{m.bailleurs > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
