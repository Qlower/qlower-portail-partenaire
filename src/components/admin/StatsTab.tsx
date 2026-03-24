"use client";

import { useState, useEffect } from "react";
import type { Partner } from "@/types";
import { calcCommission } from "@/services/commission";
import { api } from "@/lib/axios";
import { Card, Stat, Badge } from "@/components/ui";

export default function StatsTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/partners")
      .then((res) => setPartners(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
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
        <Stat icon="handshake" value={active.length} label="Partenaires actifs" />
        <Stat icon="users" value={totalLeads} label="Total leads" />
        <Stat icon="user-check" value={totalAbonnes} label="Total abonnes" />
        <Stat icon="coins" value={`${totalCommissions} EUR`} label="Total commissions" />
      </div>

      {/* Detailed table */}
      <Card>
        <h4 className="font-semibold text-gray-900 mb-4">Detail par partenaire</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 text-xs text-gray-500 font-medium">Partenaire</th>
                <th className="pb-2 text-xs text-gray-500 font-medium">Regles actives</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Leads</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Abonnes</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Commission</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Taux conversion</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-center">MB eligibilite</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const commission = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
                const activeRules = p.comm_rules.filter((r) => r.actif).length;
                const taux = p.leads > 0 ? ((p.abonnes / p.leads) * 100).toFixed(1) : "0.0";
                const mbEligible = p.leads >= 50;

                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${p.active ? "bg-green-500" : "bg-red-400"}`}
                        />
                        <span className="font-medium text-gray-900">{p.nom}</span>
                        <Badge variant={p.contrat === "affiliation" ? "amber" : "blue"} className="text-[10px]">
                          {p.contrat === "affiliation" ? "AF" : "MB"}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-2.5">{activeRules}/4</td>
                    <td className="py-2.5 text-right">{p.leads}</td>
                    <td className="py-2.5 text-right">{p.abonnes}</td>
                    <td className="py-2.5 text-right font-semibold text-[#0A3855]">
                      {commission.total} EUR
                    </td>
                    <td className="py-2.5 text-right">{taux}%</td>
                    <td className="py-2.5 text-center">
                      <Badge variant={mbEligible ? "green" : "gray"}>
                        {mbEligible ? "Eligible" : "< 50 leads"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
