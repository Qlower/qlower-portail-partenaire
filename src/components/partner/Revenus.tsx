"use client";

import { useInvoices, useLeads } from "@/hooks/usePartnerData";
import { calcCommission, COMM_LABELS } from "@/services/commission";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Partner, Invoice } from "@/types";

interface RevenusProps {
  partner: Partner;
}

const TIMELINE_STEPS = [
  { label: "Inscription partenaire", desc: "Compte créé et validé" },
  { label: "Premier contact", desc: "Contact envoyé via le portail" },
  { label: "Premier abonné", desc: "Client ayant souscrit à Qlower" },
  { label: "Première commission", desc: "Versement de la première commission" },
  { label: "Objectif annuel", desc: "Atteinte de l'objectif fixé" },
];

function statusBadge(statut: Invoice["statut"]) {
  const map: Record<Invoice["statut"], { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    Payee: { variant: "default", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none" },
    "En attente": { variant: "secondary", className: "bg-amber-50 text-amber-700 border border-amber-200 shadow-none" },
    Annulee: { variant: "destructive", className: "bg-red-50 text-red-700 border border-red-200 shadow-none" },
  };
  const style = map[statut];
  return <Badge variant={style.variant} className={style.className}>{statut}</Badge>;
}

export default function Revenus({ partner }: RevenusProps) {
  const { data: invoices, isLoading } = useInvoices(partner.id);
  const { data: leads } = useLeads(partner.id);

  // Count actifs from real leads data
  const abonnes = leads?.filter((l) => l.stage === "Abonne").length || 0;
  const payeurs = leads?.filter((l) => l.stage === "Payeur").length || 0;
  const actifs = leads?.filter((l) => l.commission_due).length || 0;

  const commission = calcCommission(
    partner.comm_rules,
    actifs,
    partner.biens_moyens,
    partner.ca_par_client,
  );

  const paidTotal = invoices
    ? invoices.filter((i) => i.statut === "Payee").reduce((sum, i) => sum + i.montant, 0)
    : 0;

  const pendingTotal = invoices
    ? invoices.filter((i) => i.statut === "En attente").reduce((sum, i) => sum + i.montant, 0)
    : 0;

  const nextPayment = invoices?.find((i) => i.statut === "En attente");

  const objectifAnnuel = partner.comm_obj_annuel || 10000;
  const progressPct = Math.min(Math.round((paidTotal / objectifAnnuel) * 100), 100);

  // Determine how far along timeline based on data
  const totalLeads = leads?.length || 0;
  const timelineProgress = paidTotal > 0
    ? (paidTotal >= objectifAnnuel ? 4 : 3)
    : actifs > 0
      ? 2
      : totalLeads > 0
        ? 1
        : 0;

  return (
    <div className="space-y-6">
      {/* Revenue hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A3855] via-[#0d4a6f] to-[#0A3855] px-6 py-7 text-white shadow-xl shadow-[#0A3855]/20">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />

        <div className="relative">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mb-1.5">
                Commission totale estimée
              </p>
              <p className="text-4xl font-bold tracking-tight">{commission.total.toLocaleString("fr-FR")} &euro;</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
              <span className="text-xs font-medium text-white/80">{actifs} actif{actifs > 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Commission breakdown */}
          {commission.detail.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {commission.detail.map((d, i) => (
                <div key={i} className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-4 py-3 border border-white/[0.08]">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">{d.label}</p>
                  <p className="text-base font-bold text-white mt-1">{d.montant.toLocaleString("fr-FR")} &euro;</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{d.calc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="text-white/50 font-medium">Objectif annuel</span>
              <span className="font-bold text-white">{progressPct}% &mdash; {objectifAnnuel.toLocaleString("fr-FR")} &euro;</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-[#F6CCA4] to-[#e8a96e] rounded-full transition-all duration-700 ease-out shadow-sm shadow-[#F6CCA4]/30"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">En attente</p>
                <p className="text-xl font-bold text-gray-900">{pendingTotal.toLocaleString("fr-FR")} &euro;</p>
                <p className="text-[11px] text-gray-400">À verser</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E5EDF1] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0A3855]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Prochain versement</p>
                <p className="text-xl font-bold text-gray-900">
                  {nextPayment ? new Date(nextPayment.date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total versé</p>
                <p className="text-xl font-bold text-gray-900">{paidTotal.toLocaleString("fr-FR")} &euro;</p>
                <p className="text-[11px] text-gray-400">Cumul</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partnership timeline */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-900">Parcours partenaire</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-8">
            {TIMELINE_STEPS.map((s, i) => {
              const done = i <= timelineProgress;
              const current = i === timelineProgress;
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={i} className="relative pb-7 last:pb-0">
                  {/* Vertical line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[-20px] top-4 w-[2px] h-full transition-colors ${
                        done ? "bg-[#0A3855]" : "bg-gray-200"
                      }`}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className={`absolute left-[-25px] top-0.5 w-[12px] h-[12px] rounded-full border-2 transition-all ${
                      done
                        ? "bg-[#0A3855] border-[#0A3855]"
                        : "bg-white border-gray-300"
                    } ${current ? "ring-[5px] ring-[#0A3855]/15 scale-110" : ""}`}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-sm font-medium transition-colors ${done ? "text-gray-900" : "text-gray-400"}`}>
                        {s.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                    </div>
                    {!done && (
                      <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200 bg-gray-50 shadow-none ml-3 whitespace-nowrap">
                        A venir
                      </Badge>
                    )}
                    {current && done && (
                      <Badge className="text-[10px] bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10 shadow-none ml-3 whitespace-nowrap">
                        En cours
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoice table */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-900">Factures</CardTitle>
            {invoices && invoices.length > 0 && (
              <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-xs shadow-none">
                {invoices.length} facture{invoices.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 mt-3">Chargement...</p>
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-[#E5EDF1] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#0A3855]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune facture pour le moment</p>
              <p className="text-xs text-gray-400 mt-1">Vos factures appara&icirc;tront ici</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Date</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Montant</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Statut</th>
                    <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#E5EDF1]/20 transition-colors">
                      <td className="px-6 py-3.5 text-gray-700 tabular-nums">
                        {new Date(inv.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-gray-900 tabular-nums">
                        {inv.montant.toLocaleString("fr-FR")} &euro;
                      </td>
                      <td className="px-6 py-3.5">{statusBadge(inv.statut)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <a
                          href={`/api/export/invoice?id=${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#0A3855] hover:text-[#0A3855]/70 text-sm font-medium transition-colors group"
                        >
                          <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
