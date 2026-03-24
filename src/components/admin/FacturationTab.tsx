"use client";

import { useState } from "react";
import type { Partner } from "@/types";
import { calcCommission, COMM_LABELS } from "@/services/commission";
import { useAdminPartners } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Receipt,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileCheck,
  FileText,
  Info,
} from "lucide-react";

export default function FacturationTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());

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
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement de la facturation...</p>
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
      <Card className="bg-[#0A3855] text-white border-none">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Receipt className="size-6 text-white/80" />
              </div>
              <div>
                <h4 className="font-semibold text-lg">Appels a facturation -- Annuel</h4>
                <div className="flex items-center gap-1.5 mt-1.5 text-white/60 text-sm">
                  <Calendar className="size-3.5" />
                  <span>Prochain appel: {nextBillingStr}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">{totalDue} EUR</p>
              <p className="text-xs text-white/50 mt-1">
                Total du pour {activePartners.length} partenaires
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partner billing table */}
      {activePartners.length === 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>Aucun partenaire actif a facturer.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {activePartners.map((p) => {
            const commission = calcCommission(
              p.comm_rules,
              p.abonnes,
              p.biens_moyens,
              p.ca_par_client
            );
            const activeRules = p.comm_rules.filter((r) => r.actif);
            const isExpanded = expandedId === p.id;
            const isGenerated = generatedIds.has(p.id);

            return (
              <Card
                key={p.id}
                className={`transition-all ${isExpanded ? "ring-1 ring-[#0A3855]/20" : ""}`}
              >
                <CardContent>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="size-4 text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900">{p.nom}</span>
                      <Badge
                        variant="secondary"
                        className="bg-gray-50 text-gray-600 border border-gray-200"
                      >
                        {activeRules.length} regle(s)
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {p.abonnes} abonnes
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#0A3855] tabular-nums">
                        {commission.total} EUR
                      </span>
                      {isGenerated ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          <FileCheck className="size-3 mr-1" />
                          Genere
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerate(p.id);
                          }}
                        >
                          <FileText className="size-3.5 mr-1" />
                          Generer appel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Commission detail breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                        Detail du calcul
                      </p>
                      {commission.detail.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          Aucune commission calculee
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {commission.detail.map((d, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm bg-[#F8FAFB] rounded-lg px-4 py-2.5"
                            >
                              <span className="text-gray-700 font-medium">
                                {d.label}
                              </span>
                              <span className="text-gray-500">{d.calc}</span>
                              <span className="font-semibold text-gray-900 tabular-nums">
                                {d.montant} EUR
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active rules summary */}
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Regles actives
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeRules.map((r) => (
                            <Badge
                              key={r.type}
                              variant="secondary"
                              className="bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10"
                            >
                              {COMM_LABELS[r.type]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
