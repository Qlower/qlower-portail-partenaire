"use client";

import { useState, useEffect } from "react";
import type { Partner } from "@/types";
import { calcCommission, COMM_LABELS } from "@/services/commission";
import { api } from "@/lib/axios";
import { Card, Button, Badge, Alert } from "@/components/ui";

export default function FacturationTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get("/admin/partners")
      .then((res) => setPartners(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activePartners = partners.filter((p) => p.active);

  // Compute next billing date (1st of next year)
  const now = new Date();
  const nextBilling = new Date(now.getFullYear() + 1, 0, 1);
  const nextBillingStr = nextBilling.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleGenerate = (partnerId: string) => {
    setGeneratedIds((prev) => new Set(prev).add(partnerId));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
      </div>
    );
  }

  const totalDue = activePartners.reduce((s, p) => {
    const c = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
    return s + c.total;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Info card */}
      <Card className="bg-[#0A3855] text-white">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-lg">Appels a facturation -- Annuel</h4>
            <p className="text-white/70 text-sm mt-1">
              Prochain appel: {nextBillingStr}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalDue} EUR</p>
            <p className="text-xs text-white/60">Total du pour {activePartners.length} partenaires</p>
          </div>
        </div>
      </Card>

      {/* Partner billing table */}
      {activePartners.length === 0 ? (
        <Alert type="info">Aucun partenaire actif a facturer.</Alert>
      ) : (
        <div className="space-y-2">
          {activePartners.map((p) => {
            const commission = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
            const activeRules = p.comm_rules.filter((r) => r.actif);
            const isExpanded = expandedId === p.id;
            const isGenerated = generatedIds.has(p.id);

            return (
              <Card key={p.id} padding="sm">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{p.nom}</span>
                    <Badge variant="gray">{activeRules.length} regle(s)</Badge>
                    <span className="text-sm text-gray-500">{p.abonnes} abonnes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[#0A3855]">{commission.total} EUR</span>
                    {isGenerated ? (
                      <Badge variant="green">Genere</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerate(p.id);
                        }}
                      >
                        Generer appel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Commission detail breakdown */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">Detail du calcul</p>
                    {commission.detail.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune commission calculee</p>
                    ) : (
                      <div className="space-y-1.5">
                        {commission.detail.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                            <span className="text-gray-600">{d.label}</span>
                            <span className="text-gray-500">{d.calc}</span>
                            <span className="font-semibold">{d.montant} EUR</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active rules summary */}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Regles actives</p>
                      <div className="flex flex-wrap gap-1">
                        {activeRules.map((r) => (
                          <Badge key={r.type} variant="blue">
                            {COMM_LABELS[r.type]}
                          </Badge>
                        ))}
                      </div>
                    </div>
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
