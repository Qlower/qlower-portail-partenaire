"use client";

import { useState } from "react";
import { useInvoices, useLeads, useCommissions } from "@/hooks/usePartnerData";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Partner, Invoice } from "@/types";
import PartnerInvoicesSection from "./PartnerInvoicesSection";

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

type YearFilter = number | "all";

export default function Revenus({ partner }: RevenusProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<YearFilter>("all");
  const { data: invoices, isLoading } = useInvoices(partner.id);
  const { data: leads } = useLeads(partner.id);
  const { data: commissionData, isLoading: commLoading } = useCommissions(partner.id, selectedYear);

  const paidTotal = invoices
    ? invoices.filter((i) => i.statut === "Payee").reduce((sum, i) => sum + i.montant, 0)
    : 0;

  const pendingTotal = invoices
    ? invoices.filter((i) => i.statut === "En attente").reduce((sum, i) => sum + i.montant, 0)
    : 0;

  const nextPayment = invoices?.find((i) => i.statut === "En attente");

  const objectifAnnuel = partner.comm_obj_annuel || 10000;
  const totalCommission = commissionData?.totalCommission ?? 0;
  const progressPct = Math.min(Math.round((totalCommission / objectifAnnuel) * 100), 100);

  // Determine how far along timeline based on data
  const totalLeads = leads?.length || 0;
  const totalSubscribers = commissionData?.totalSubscribers ?? 0;
  const timelineProgress = paidTotal > 0
    ? (paidTotal >= objectifAnnuel ? 4 : 3)
    : totalSubscribers > 0
      ? 2
      : totalLeads > 0
        ? 1
        : 0;

  const yearOptions: YearFilter[] = ["all", currentYear, currentYear - 1, currentYear - 2];

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
                Commission {selectedYear === "all" ? "cumul" : selectedYear}
              </p>
              <p className="text-4xl font-bold tracking-tight">
                {commLoading ? "..." : `${totalCommission.toLocaleString("fr-FR")} €`}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {selectedYear === "all" ? (
                  <>Cumul historique sur {totalSubscribers} abonné{totalSubscribers > 1 ? "s" : ""}</>
                ) : (
                  <>Pour l&apos;année {selectedYear} — {totalSubscribers} abonné{totalSubscribers > 1 ? "s" : ""}</>
                )}
              </p>

              {/* Détail des règles actives — masque les inactives */}
              {commissionData?.ruleDetails && commissionData.ruleDetails.filter((r) => r.montant > 0).length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 max-w-md">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                    Votre mode de calcul
                  </p>
                  <div className="space-y-0.5">
                    {commissionData.ruleDetails
                      .filter((r) => r.montant > 0)
                      .map((r, i) => (
                        <p key={i} className="text-[11px] text-white/60 leading-relaxed">
                          <span className="font-semibold text-white/80">{r.label}</span> :{" "}
                          {r.montant}&nbsp;€
                          {r.type === "recurring"
                            ? " par abonné actif, chaque année"
                            : " par nouvel abonné (année de souscription)"}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Year selector */}
              <select
                value={String(selectedYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedYear(v === "all" ? "all" : Number(v));
                }}
                className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-xs font-medium text-white/80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {yearOptions.map((y) => (
                  <option key={String(y)} value={String(y)} className="bg-[#0A3855] text-white">
                    {y === "all" ? "Toutes années" : y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Commission breakdown cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-4 py-3 border border-white/[0.08]">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                {selectedYear === "all" ? "Abonnés (toutes)" : `Abonnés ${selectedYear}`}
              </p>
              <p className="text-base font-bold text-white mt-1">{totalSubscribers}</p>
              <p className="text-[10px] text-white/30 mt-0.5">sur {commissionData?.totalContacts ?? 0} contacts total</p>
            </div>
            <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-4 py-3 border border-white/[0.08]">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Année {commissionData?.previousYear?.year ?? currentYear - 1}
              </p>
              <p className="text-base font-bold text-white mt-1">
                {(commissionData?.previousYear.totalCommission ?? 0).toLocaleString("fr-FR")} €
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {commissionData?.previousYear.totalSubscribers ?? 0} abonné{(commissionData?.previousYear.totalSubscribers ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="text-white/50 font-medium">Objectif annuel</span>
              <span className="font-bold text-white">{progressPct}% &mdash; {objectifAnnuel.toLocaleString("fr-FR")} €</span>
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

      {/* Monthly breakdown table */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-900">
              Détail mensuel {selectedYear === "all" ? currentYear : selectedYear}
            </CardTitle>
            <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-xs shadow-none">
              {totalSubscribers} abonné{totalSubscribers > 1 ? "s" : ""} · {totalCommission.toLocaleString("fr-FR")} €
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {commLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 mt-3">Chargement...</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Mois</th>
                    <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Abonnés</th>
                    <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Commission</th>
                    <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">N-1</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 pb-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(commissionData?.months ?? []).map((m) => {
                    const hasData = m.subscribers > 0;
                    const diff = m.subscribers - m.previousYear;
                    return (
                      <tr
                        key={m.month}
                        className={`transition-colors ${hasData ? "bg-emerald-50/30 hover:bg-emerald-50/50" : "hover:bg-gray-50/50"}`}
                      >
                        <td className="px-6 py-3 font-medium text-gray-700">{m.label}</td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {hasData ? (
                            <span className="font-semibold text-[#0A3855]">{m.subscribers}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {hasData ? (
                            <span className="font-bold text-[#0A3855]">{m.commission.toLocaleString("fr-FR")} €</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {m.previousYear > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-gray-400 text-xs">{m.previousYear}</span>
                              {diff !== 0 && (
                                <span className={`text-[10px] font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {diff > 0 ? "+" : ""}{diff}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {m.subscriberNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {(m.subscriberDetails && m.subscriberDetails.length > 0
                                ? m.subscriberDetails
                                : m.subscriberNames.map((n) => ({
                                    name: n,
                                    isCurrentlySubscriber: true,
                                    isResubscription: false,
                                    unsubscribedDuringYear: false,
                                    exitDate: null as string | null,
                                  }))
                              ).map((s, i) => {
                                const showUnsubBadge = s.unsubscribedDuringYear || (!s.isCurrentlySubscriber && s.exitDate);
                                return (
                                  <span
                                    key={i}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                      showUnsubBadge
                                        ? "bg-orange-50 text-orange-700 border border-orange-200"
                                        : s.isResubscription
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "bg-[#E5EDF1] text-[#0A3855]"
                                    }`}
                                    title={
                                      showUnsubBadge && s.exitDate
                                        ? `Désabonné le ${new Date(s.exitDate).toLocaleDateString("fr-FR")} — commission conservée (règle N+1)`
                                        : s.isResubscription
                                        ? "Réabonnement — prime de souscription non redéclenchée"
                                        : undefined
                                    }
                                  >
                                    {s.name}
                                    {showUnsubBadge && (
                                      <span className="text-[9px] font-semibold">· Désabonné</span>
                                    )}
                                    {s.isResubscription && !showUnsubBadge && (
                                      <span className="text-[9px] font-semibold">· Réabo</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total row */}
                <tfoot>
                  <tr className="border-t-2 border-[#0A3855]/20 bg-[#E5EDF1]/30">
                    <td className="px-6 py-3 font-bold text-gray-900">Total</td>
                    <td className="px-6 py-3 text-right font-bold text-[#0A3855] tabular-nums">{totalSubscribers}</td>
                    <td className="px-6 py-3 text-right font-bold text-[#0A3855] tabular-nums">{totalCommission.toLocaleString("fr-FR")} €</td>
                    <td className="px-6 py-3 text-right text-gray-400 tabular-nums text-xs">
                      {commissionData?.previousYear.totalSubscribers ?? 0} abonnés
                    </td>
                    <td className="px-6 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                <p className="text-xl font-bold text-gray-900">{pendingTotal.toLocaleString("fr-FR")} €</p>
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
                <p className="text-xl font-bold text-gray-900">{paidTotal.toLocaleString("fr-FR")} €</p>
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

      {/* Nouveau système de factures partenaires (appel à facturation + upload) */}
      <PartnerInvoicesSection partnerId={partner.id} />

      {/* Ancien tableau de factures (historique legacy, à retirer plus tard) */}
      {invoices && invoices.length > 0 && (
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-900">Historique (ancien système)</CardTitle>
            <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-xs shadow-none">
              {invoices.length} facture{invoices.length > 1 ? "s" : ""}
            </Badge>
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
              <p className="text-xs text-gray-400 mt-1">Vos factures apparaîtront ici</p>
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
                        {inv.montant.toLocaleString("fr-FR")} €
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
      )}
    </div>
  );
}
