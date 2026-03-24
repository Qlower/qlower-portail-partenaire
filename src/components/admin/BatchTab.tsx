"use client";

import { useState } from "react";
import type { PartnerType, ContratType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { useBatchCreatePartners } from "@/hooks/useAdminData";
import { Card, Button, Input, Select, Badge, Alert, AlertDescription } from "@/components/ui";

interface BatchRow {
  nom: string;
  type: PartnerType;
  contrat: ContratType;
}

interface CreatedPartner {
  nom: string;
  code: string;
  email: string;
  temp_password: string;
}

const CONTRAT_OPTIONS = [
  { value: "affiliation", label: "Affiliation" },
  { value: "marque_blanche", label: "Marque blanche" },
];

const emptyRow = (): BatchRow => ({ nom: "", type: "cgp", contrat: "affiliation" });

export default function BatchTab() {
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [csvText, setCsvText] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedPartner[]>([]);

  const updateRow = (index: number, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    if (rows.length > 1) setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCsvParse = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    const parsed: BatchRow[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((s) => s.trim());
      if (parts[0]) {
        parsed.push({
          nom: parts[0],
          type: (PARTNER_TYPES.includes(parts[1] as PartnerType) ? parts[1] : "cgp") as PartnerType,
          contrat: (parts[2] === "marque_blanche" ? "marque_blanche" : "affiliation") as ContratType,
        });
      }
    }
    if (parsed.length > 0) setRows(parsed);
  };

  const validRows = rows.filter((r) => r.nom.trim());

  const batchMutation = useBatchCreatePartners();

  const handleCreate = async () => {
    if (validRows.length === 0) return;
    setCreating(true);
    setError("");
    try {
      const result = await batchMutation.mutateAsync(validRows);
      setCreated((result.created || []) as unknown as CreatedPartner[]);
    } catch {
      setError("Erreur lors de la création batch");
    } finally {
      setCreating(false);
    }
  };

  const handleExportCsv = () => {
    const header = "nom,code,email,mot_de_passe\n";
    const body = created.map((p) => `${p.nom},${p.code},${p.email},${p.temp_password}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partenaires-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const afCount = validRows.filter((r) => r.contrat === "affiliation").length;
  const mbCount = validRows.filter((r) => r.contrat === "marque_blanche").length;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* CSV Import */}
      <Card>
        <h4 className="font-semibold text-gray-900 mb-3">Import CSV</h4>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-3">
          <p className="text-sm text-gray-500 mb-2">
            Collez votre CSV ici (format : nom, type, contrat)
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"Cabinet Dupont,cgp,affiliation\nAgence Martin,agence-immo,marque_blanche"}
            className="w-full h-24 p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A3855]/30 resize-none font-mono"
          />
          <Button variant="secondary" className="mt-2" onClick={handleCsvParse} disabled={!csvText.trim()}>
            Parser le CSV
          </Button>
        </div>
      </Card>

      {/* Manual entry */}
      <Card>
        <h4 className="font-semibold text-gray-900 mb-3">Saisie manuelle</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-xs text-gray-500 font-medium">Nom</th>
                <th className="text-left pb-2 text-xs text-gray-500 font-medium">Type</th>
                <th className="text-left pb-2 text-xs text-gray-500 font-medium">Contrat</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 pr-2">
                    <Input
                      value={row.nom}
                      onChange={(e) => updateRow(i, { nom: e.target.value })}
                      placeholder="Nom du partenaire"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Select
                      value={row.type}
                      onChange={(e) => updateRow(i, { type: e.target.value as PartnerType })}
                      options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Select
                      value={row.contrat}
                      onChange={(e) => updateRow(i, { contrat: e.target.value as ContratType })}
                      options={CONTRAT_OPTIONS}
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 text-xs px-2"
                      disabled={rows.length <= 1}
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 mt-3">
          <Button variant="ghost" onClick={addRow}>
            + Ajouter ligne
          </Button>
        </div>
      </Card>

      {/* Summary */}
      <Card size="sm" className="bg-gray-50">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            {validRows.length} ligne(s) valide(s)
          </span>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">{afCount} AF</Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">{mbCount} MB</Badge>
        </div>
      </Card>

      {/* Create button */}
      {created.length === 0 && (
        <Button
          className="bg-[#F6CCA4] text-[#1C1C1C] hover:bg-[#F5C89A]"
          onClick={handleCreate}
          disabled={creating || validRows.length === 0}
        >
          {creating ? "Creation..." : `Creer ${validRows.length} partenaire(s)`}
        </Button>
      )}

      {/* Success state */}
      {created.length > 0 && (
        <Card className="border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-green-800">
              {created.length} partenaire(s) cree(s) avec succes
            </h4>
            <Button variant="secondary" onClick={handleExportCsv}>
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-2 text-xs text-gray-500">Nom</th>
                  <th className="text-left pb-2 text-xs text-gray-500">Code</th>
                  <th className="text-left pb-2 text-xs text-gray-500">Email</th>
                  <th className="text-left pb-2 text-xs text-gray-500">Mot de passe temp.</th>
                </tr>
              </thead>
              <tbody>
                {created.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5">{p.nom}</td>
                    <td className="py-1.5 font-mono text-xs">{p.code}</td>
                    <td className="py-1.5">{p.email}</td>
                    <td className="py-1.5 font-mono text-xs text-red-600">{p.temp_password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
