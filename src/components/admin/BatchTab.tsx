"use client";

import { useState } from "react";
import type { PartnerType, ContratType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { useBatchCreatePartners } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select } from "@/components/ui/select-custom";
import {
  Upload,
  Plus,
  Trash2,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Table2,
} from "lucide-react";

interface BatchRow {
  nom: string;
  email: string;
  utm: string;
  code: string;
  type: PartnerType;
  contrat: ContratType;
}

interface CreatedPartner {
  nom: string;
  code: string;
  utm: string;
  email: string;
  tempPassword: string;
}

const CONTRAT_OPTIONS = [
  { value: "affiliation", label: "Affiliation" },
  { value: "marque_blanche", label: "Marque blanche" },
];

const emptyRow = (): BatchRow => ({ nom: "", email: "", utm: "", code: "", type: "cgp", contrat: "affiliation" });

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
          email: parts[1] || "",
          utm: parts[2] || "",
          code: parts[3] || "",
          type: (PARTNER_TYPES.includes(parts[4] as PartnerType) ? parts[4] : "cgp") as PartnerType,
          contrat: (parts[5] === "marque_blanche" ? "marque_blanche" : "affiliation") as ContratType,
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
      setError("Erreur lors de la creation batch");
    } finally {
      setCreating(false);
    }
  };

  const handleExportCsv = () => {
    const header = "nom,email,utm,code_promo,mot_de_passe\n";
    const body = created.map((p) => `${p.nom},${p.email},${p.utm || ""},${p.code || ""},${p.tempPassword}`).join("\n");
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
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* CSV Import */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-[#0A3855]" />
            Import CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-[#F8FAFB] hover:border-[#0A3855]/30 transition-colors">
            <FileSpreadsheet className="size-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium mb-1">
              Collez votre CSV ici
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Format : nom, email, utm, code promo, type, contrat
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"Cabinet Dupont,contact@dupont.fr,Dupont,DUPONT20,cgp,affiliation\nAgence Martin,martin@agence.fr,Martin,MARTIN25,agence-immo,marque_blanche"}
              className="w-full h-24 p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855] resize-none font-mono bg-white"
            />
            <Button
              variant="outline"
              className="mt-3"
              onClick={handleCsvParse}
              disabled={!csvText.trim()}
            >
              <Upload className="size-4 mr-1.5" />
              Parser le CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Table2 className="size-4 text-[#0A3855]" />
            Saisie manuelle
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    UTM
                  </th>
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code Promo
                  </th>
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrat
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={i} className="group">
                    <td className="py-2 pr-3">
                      <Input
                        value={row.nom}
                        onChange={(e) => updateRow(i, { nom: e.target.value })}
                        placeholder="Nom du partenaire"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="email"
                        value={row.email}
                        onChange={(e) => updateRow(i, { email: e.target.value })}
                        placeholder="email@partenaire.com"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={row.utm}
                        onChange={(e) => updateRow(i, { utm: e.target.value })}
                        placeholder="utm (auto si vide)"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={row.code}
                        onChange={(e) => updateRow(i, { code: e.target.value })}
                        placeholder="code promo (optionnel)"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={row.type}
                        onChange={(e) => updateRow(i, { type: e.target.value as PartnerType })}
                        options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={row.contrat}
                        onChange={(e) => updateRow(i, { contrat: e.target.value as ContratType })}
                        options={CONTRAT_OPTIONS}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="ghost" onClick={addRow} className="mt-3">
            <Plus className="size-4 mr-1.5" />
            Ajouter ligne
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-[#F8FAFB]">
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 font-medium">
              {validRows.length} ligne(s) valide(s)
            </span>
            <Badge
              variant="secondary"
              className="bg-amber-50 text-amber-700 border border-amber-200"
            >
              {afCount} AF
            </Badge>
            <Badge
              variant="secondary"
              className="bg-sky-50 text-sky-700 border border-sky-200"
            >
              {mbCount} MB
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create button */}
      {created.length === 0 && (
        <Button
          className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
          onClick={handleCreate}
          disabled={creating || validRows.length === 0}
        >
          {creating ? (
            <>
              <Loader2 className="size-4 mr-1.5 animate-spin" />
              Creation...
            </>
          ) : (
            `Creer ${validRows.length} partenaire(s)`
          )}
        </Button>
      )}

      {/* Success state */}
      {created.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="border-b border-emerald-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="size-5" />
                {created.length} partenaire(s) cree(s) avec succes
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="size-4 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-100">
                    <th className="text-left pb-2 text-xs font-medium text-emerald-600 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-emerald-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-emerald-600 uppercase tracking-wider">
                      UTM
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-emerald-600 uppercase tracking-wider">
                      Code Promo
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-emerald-600 uppercase tracking-wider">
                      Mot de passe temp.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {created.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium text-gray-900">{p.nom}</td>
                      <td className="py-2 text-gray-600">{p.email}</td>
                      <td className="py-2 font-mono text-xs text-gray-600">{p.utm}</td>
                      <td className="py-2 font-mono text-xs text-gray-600">{p.code || <span className="text-gray-400 italic">—</span>}</td>
                      <td className="py-2 font-mono text-xs text-red-600 bg-red-50/50 rounded px-2">
                        {p.tempPassword}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
