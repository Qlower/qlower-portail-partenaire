"use client";

import { calcCommission } from "@/services/commission";
import { useAdminPartners } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/Stat";
import { Loader2, Handshake, Users, UserCheck, Coins } from "lucide-react";

export default function StatsTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement des statistiques...</p>
      </div>
    );
  }

  const active = partners.filter((p) => p.active);
  const totalLeads = partners.reduce((s, p) => s + p.leads, 0);
  const totalAbonnes = partners.reduce((s, p) => s + p.abonnes, 0);
  const totalCommissions = partners.reduce((s, p) => {
    const c = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
    return s + c.total;
  }, 0);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={<Handshake className="size-5" />}
          value={active.length}
          label="Partenaires actifs"
        />
        <Stat
          icon={<Users className="size-5" />}
          value={totalLeads}
          label="Total leads"
        />
        <Stat
          icon={<UserCheck className="size-5" />}
          value={totalAbonnes}
          label="Total abonnes"
        />
        <Stat
          icon={<Coins className="size-5" />}
          value={`${totalCommissions} EUR`}
          label="Total commissions"
        />
      </div>

      {/* Detailed table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Detail par partenaire</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partenaire
                  </th>
                  <th className="py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regles actives
                  </th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leads
                  </th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abonnes
                  </th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taux conversion
                  </th>
                  <th className="py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MB eligibilite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partners.map((p) => {
                  const commission = calcCommission(
                    p.comm_rules,
                    p.abonnes,
                    p.biens_moyens,
                    p.ca_par_client
                  );
                  const activeRules = p.comm_rules.filter((r) => r.actif).length;
                  const taux =
                    p.leads > 0 ? ((p.abonnes / p.leads) * 100).toFixed(1) : "0.0";
                  const mbEligible = p.leads >= 50;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#F8FAFB] transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              p.active ? "bg-emerald-500" : "bg-red-400"
                            }`}
                          />
                          <span className="font-medium text-gray-900">{p.nom}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              p.contrat === "affiliation"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-sky-50 text-sky-700 border border-sky-200"
                            }`}
                          >
                            {p.contrat === "affiliation" ? "AF" : "MB"}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="text-gray-600">{activeRules}/4</span>
                      </td>
                      <td className="py-3 text-right tabular-nums">{p.leads}</td>
                      <td className="py-3 text-right tabular-nums">{p.abonnes}</td>
                      <td className="py-3 text-right font-semibold text-[#0A3855] tabular-nums">
                        {commission.total} EUR
                      </td>
                      <td className="py-3 text-right tabular-nums">{taux}%</td>
                      <td className="py-3 text-center">
                        <Badge
                          variant="secondary"
                          className={
                            mbEligible
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-50 text-gray-500 border border-gray-200"
                          }
                        >
                          {mbEligible ? "Eligible" : "< 50 leads"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
