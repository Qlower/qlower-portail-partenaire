"use client";

import { useState } from "react";
import type { CommissionRule, Tranche } from "@/types";
import { COMM_LABELS, DEFAULT_TRANCHES, calcCommission } from "@/services/commission";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Calculator,
  Euro,
} from "lucide-react";

interface CommissionEditorProps {
  rules: CommissionRule[];
  onChange: (rules: CommissionRule[]) => void;
  abonnes?: number;
  biensMoyens?: number;
  caParClient?: number;
}

const DEFAULT_RULES: CommissionRule[] = [
  { type: "souscription", montant: 0, actif: false },
  { type: "annuelle", montant: 0, actif: false },
  { type: "biens", tranches: DEFAULT_TRANCHES(), actif: false },
  { type: "pct_ca", pct: 0, actif: false },
];

function ensureAllRules(rules: CommissionRule[]): CommissionRule[] {
  return DEFAULT_RULES.map((def) => {
    const existing = rules.find((r) => r.type === def.type);
    return existing || { ...def };
  });
}

export default function CommissionEditor({
  rules,
  onChange,
  abonnes = 10,
  biensMoyens = 2,
  caParClient = 300,
}: CommissionEditorProps) {
  const allRules = ensureAllRules(rules);
  const [previewAbonnes] = useState(abonnes);

  const updateRule = (index: number, patch: Partial<CommissionRule>) => {
    const updated = allRules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(updated);
  };

  const updateTranche = (ruleIndex: number, trancheIndex: number, patch: Partial<Tranche>) => {
    const rule = allRules[ruleIndex];
    const tranches = [...(rule.tranches || DEFAULT_TRANCHES())];
    tranches[trancheIndex] = { ...tranches[trancheIndex], ...patch };
    updateRule(ruleIndex, { tranches });
  };

  const addTranche = (ruleIndex: number) => {
    const rule = allRules[ruleIndex];
    const tranches = [...(rule.tranches || DEFAULT_TRANCHES()), { max: 99, montant: 0 }];
    updateRule(ruleIndex, { tranches });
  };

  const removeTranche = (ruleIndex: number, trancheIndex: number) => {
    const rule = allRules[ruleIndex];
    const tranches = (rule.tranches || DEFAULT_TRANCHES()).filter((_, i) => i !== trancheIndex);
    if (tranches.length > 0) updateRule(ruleIndex, { tranches });
  };

  const result = calcCommission(allRules, previewAbonnes, biensMoyens, caParClient);

  const warnings = allRules.filter(
    (r) =>
      r.actif &&
      ((r.type === "souscription" && !r.montant) ||
        (r.type === "annuelle" && !r.montant) ||
        (r.type === "pct_ca" && !r.pct))
  );

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Regles de commission
      </p>

      <div className="space-y-3">
        {allRules.map((rule, idx) => (
          <div
            key={rule.type}
            className={`rounded-xl border-2 p-4 transition-all ${
              rule.actif
                ? "border-[#0A3855]/20 bg-[#E5EDF1]/20"
                : "border-gray-100 bg-gray-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-medium ${
                  rule.actif ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {COMM_LABELS[rule.type]}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.actif}
                  onChange={(e) => updateRule(idx, { actif: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#0A3855]/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-[#0A3855]" />
              </label>
            </div>

            {rule.actif && (
              <div className="mt-3 pt-3 border-t border-gray-200/50">
                {(rule.type === "souscription" || rule.type === "annuelle") && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={rule.montant ?? 0}
                      onChange={(e) => updateRule(idx, { montant: Number(e.target.value) })}
                      className="w-28"
                    />
                    <span className="text-sm text-gray-500">EUR / abonne</span>
                  </div>
                )}

                {rule.type === "pct_ca" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={rule.pct ?? 0}
                      onChange={(e) => updateRule(idx, { pct: Number(e.target.value) })}
                      className="w-28"
                    />
                    <span className="text-sm text-gray-500">% du CA genere</span>
                  </div>
                )}

                {rule.type === "biens" && (
                  <div className="space-y-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase tracking-wider">
                          <th className="text-left pb-2 font-medium">Max biens</th>
                          <th className="text-left pb-2 font-medium">Montant (EUR)</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(rule.tranches || DEFAULT_TRANCHES()).map((tr, ti) => (
                          <tr key={ti} className="group">
                            <td className="pr-3 py-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={tr.max}
                                onChange={(e) =>
                                  updateTranche(idx, ti, { max: Number(e.target.value) })
                                }
                                className="w-24"
                              />
                            </td>
                            <td className="pr-3 py-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={tr.montant}
                                onChange={(e) =>
                                  updateTranche(idx, ti, { montant: Number(e.target.value) })
                                }
                                className="w-24"
                              />
                            </td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                onClick={() => removeTranche(idx, ti)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={() => addTranche(idx)}
                      className="flex items-center gap-1 text-xs text-[#0A3855] hover:text-[#0A3855]/70 font-medium transition-colors"
                    >
                      <Plus className="size-3.5" />
                      Ajouter tranche
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {warnings.length} regle(s) active(s) avec valeur a 0 -- aucune commission ne
            sera calculee.
          </AlertDescription>
        </Alert>
      )}

      {/* Live preview */}
      <Card className="bg-[#F8FAFB] border-dashed">
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="size-4 text-gray-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Apercu (pour {previewAbonnes} abonnes, {biensMoyens} biens/client,{" "}
              {caParClient} EUR CA/client)
            </p>
          </div>
          {result.detail.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune regle active</p>
          ) : (
            <div className="space-y-1.5">
              {result.detail.map((d, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-1"
                >
                  <span className="text-gray-600">
                    {d.label}: {d.calc}
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {d.montant} EUR
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-sm font-bold">
                <span className="flex items-center gap-1.5">
                  <Euro className="size-3.5 text-[#0A3855]" />
                  Total
                </span>
                <span className="text-[#0A3855] tabular-nums">{result.total} EUR</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
