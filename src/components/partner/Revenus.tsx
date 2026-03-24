"use client";

import { useInvoices, useLeads } from "@/hooks/usePartnerData";
import { calcCommission, COMM_LABELS } from "@/services/commission";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import type { Partner, Invoice } from "@/types";

interface RevenusProps {
  partner: Partner;
}

const TIMELINE_STEPS = [
  { label: "Inscription partenaire", desc: "Compte cree et valide" },
  { label: "Premier referral", desc: "Contact envoye via le portail" },
  { label: "Premier abonne", desc: "Client ayant souscrit a Qlower" },
  { label: "Premiere commission", desc: "Versement de la premiere commission" },
  { label: "Objectif annuel", desc: "Atteinte de l'objectif fixe" },
];

function statusBadge(statut: Invoice["statut"]) {
  const map: Record<Invoice["statut"], "green" | "amber" | "red"> = {
    Payee: "green",
    "En attente": "amber",
    Annulee: "red",
  };
  return <Badge variant={map[statut]}>{statut}</Badge>;
}

export default function Revenus({ partner }: RevenusProps) {
  const { data: invoices, isLoading } = useInvoices(partner.id);
  const { data: leads } = useLeads(partner.id);

  // Count actifs from real leads data
  const abonnes = leads?.filter((l) => l.stage === "Abonne").length || 0;
  const payeurs = leads?.filter((l) => l.stage === "Payeur").length || 0;
  const actifs = abonnes + payeurs;

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
    <div>
      {/* Revenue header with gradient */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl px-6 py-6 mb-5 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
              Commission totale estimee
            </p>
            <p className="text-3xl font-bold">{commission.total.toLocaleString("fr-FR")} &euro;</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-1.5">
            <span className="text-xs font-medium text-gray-300">{actifs} actif{actifs > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Commission breakdown */}
        {commission.detail.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {commission.detail.map((d, i) => (
              <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{d.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{d.montant.toLocaleString("fr-FR")} &euro;</p>
                <p className="text-[10px] text-gray-500">{d.calc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-400">Objectif annuel</span>
            <span className="font-semibold text-white">{progressPct}% &mdash; {objectifAnnuel.toLocaleString("fr-FR")} &euro;</span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0A3855] to-[#1a5a7a] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat
          icon="&#x23F3;"
          value={`${pendingTotal.toLocaleString("fr-FR")} \u20AC`}
          label="En attente"
          subtitle="A verser"
        />
        <Stat
          icon="&#x1F4C5;"
          value={nextPayment ? new Date(nextPayment.date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "-"}
          label="Prochain versement"
        />
        <Stat
          icon="&#x2705;"
          value={`${paidTotal.toLocaleString("fr-FR")} \u20AC`}
          label="Total verse"
          subtitle="Cumul"
        />
      </div>

      {/* Partnership timeline */}
      <Card className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Parcours partenaire
        </h3>
        <div className="relative pl-6">
          {TIMELINE_STEPS.map((s, i) => {
            const done = i <= timelineProgress;
            const current = i === timelineProgress;
            return (
              <div key={i} className="relative pb-6 last:pb-0">
                {/* Vertical line */}
                {i < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={`absolute left-[-16px] top-3 w-0.5 h-full ${
                      done ? "bg-[#0A3855]" : "bg-gray-200"
                    }`}
                  />
                )}
                {/* Dot */}
                <div
                  className={`absolute left-[-21px] top-0.5 w-[10px] h-[10px] rounded-full border-2 ${
                    done
                      ? "bg-[#0A3855] border-[#0A3855]"
                      : "bg-white border-gray-300"
                  } ${current ? "ring-4 ring-[#0A3855]/20" : ""}`}
                />
                <div>
                  <p className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invoice table */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Factures
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">Chargement...</p>
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Aucune facture pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Montant</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">Statut</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 pb-3">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-700">
                      {new Date(inv.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {inv.montant.toLocaleString("fr-FR")} &euro;
                    </td>
                    <td className="px-5 py-3">{statusBadge(inv.statut)}</td>
                    <td className="px-5 py-3 text-right">
                      <a
                        href={`/api/export/invoice?id=${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#0A3855] hover:text-[#1a5a7a] text-sm font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </Card>
    </div>
  );
}
