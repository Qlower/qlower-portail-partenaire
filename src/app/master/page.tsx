"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, Euro, Target, ChevronRight, Trophy, LogOut, ArrowLeft } from "lucide-react";

interface Agency {
  id: string;
  nom: string;
  code: string;
  bailleurs: number;
  leads: number;
  ca: number;
}
interface Overview {
  network: { id: string; nom: string; statut: string; brand_label: string | null; objectif: number | null };
  totals: { bailleurs: number; leads: number; ca: number; agences: number };
  objectif: number | null;
}

const fmtEUR = (n: number) => Math.round(n).toLocaleString("fr-FR");

export default function MasterPage() {
  const { signOut } = useAuth();
  // ?network= : présent uniquement quand un admin visualise le siège d'un réseau.
  const [network] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("network") : null,
  );
  const qs = network ? `?network=${encodeURIComponent(network)}` : "";
  const { data, isLoading, error } = useQuery<Overview & { agencies: Agency[] }>({
    queryKey: ["master-overview", network],
    queryFn: async () => {
      const res = await fetch(`/api/master/overview${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement de la vue siège…</p>
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

  const objectif = data.objectif ?? 0;
  const pct = objectif > 0 ? Math.min(Math.round((data.totals.bailleurs / objectif) * 100), 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-6">
      {/* En-tête co-brand */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold">Vue siège · consolidé</p>
          <h1 className="text-2xl font-bold text-[#0A3855]">{data.network.brand_label || data.network.nom}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10 shadow-none">
            {data.network.statut === "pilote" ? "Phase pilote" : "Réseau"} · {data.totals.agences} agence{data.totals.agences > 1 ? "s" : ""}
          </Badge>
          {network ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0A3855] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Retour admin
            </Link>
          ) : (
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0A3855] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="size-3.5" />
              Se déconnecter
            </button>
          )}
        </div>
      </div>

      {/* KPI consolidés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0A3855] text-white border-none">
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center"><Users className="size-5 text-white/80" /></div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Bailleurs onboardés</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{data.totals.bailleurs}</p>
                <p className="text-[10px] text-white/40 mt-0.5">sur {data.totals.leads} contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Euro className="size-5 text-emerald-600" /></div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">CA généré (réseau)</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{fmtEUR(data.totals.ca)} €</p>
                <p className="text-[10px] text-gray-400 mt-0.5">par les bailleurs apportés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFF5ED] flex items-center justify-center"><Target className="size-5 text-[#B8864E]" /></div>
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Objectif Convention</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {data.totals.bailleurs}{objectif > 0 ? <span className="text-sm text-gray-400">/{objectif}</span> : null}
                </p>
                {objectif > 0 && (
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-[#F6CCA4] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classement des agences */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="size-4 text-[#B8864E]" />
            <h2 className="text-sm font-semibold text-[#0A3855]">Classement des agences</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#E5EDF1]/40">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">#</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">Agence</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">Bailleurs</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">Contacts</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider">CA généré</th>
                  <th className="px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.agencies.map((a, i) => (
                  <tr key={a.id} className="hover:bg-[#E5EDF1]/15">
                    <td className="px-4 py-2.5 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-gray-900">{a.nom}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{a.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#0A3855] tabular-nums">{a.bailleurs}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{a.leads}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtEUR(a.ca)} €</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/master/agence/${a.id}${qs}`} className="inline-flex items-center text-[#0A3855] hover:underline text-xs">
                        Détail <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.agencies.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">Aucune agence rattachée à ce réseau.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Production fiscale = Metabase (pilote) */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
        <Building2 className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <span>
          Suivi de <strong>production fiscale</strong> (liasses, étapes, délais) : voir <strong>Metabase</strong> pour la phase pilote.
          L&apos;intégration dans cette vue arrivera avec l&apos;accès à la base produit.
        </span>
      </div>
    </div>
  );
}
