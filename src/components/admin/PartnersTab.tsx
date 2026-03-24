"use client";

import { useState } from "react";
import type { Partner, CommissionRule, ContratType, PartnerType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { calcCommission, DEFAULT_TRANCHES } from "@/services/commission";
import { slug } from "@/services/links";
import { useAdminPartners, useCreatePartner, useUpdatePartner } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select-custom";
import CommissionEditor from "./CommissionEditor";
import {
  Plus,
  X,
  Pencil,
  ChevronUp,
  Power,
  PowerOff,
  Loader2,
  UserPlus,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";

const CONTRAT_OPTIONS = [
  { value: "affiliation", label: "Affiliation" },
  { value: "marque_blanche", label: "Marque blanche" },
];

const DEFAULT_COMM_RULES: CommissionRule[] = [
  { type: "souscription", montant: 50, actif: true },
  { type: "annuelle", montant: 0, actif: false },
  { type: "biens", tranches: DEFAULT_TRANCHES(), actif: false },
  { type: "pct_ca", pct: 0, actif: false },
];

interface NewPartnerForm {
  identifiant: string;
  nom: string;
  type: PartnerType;
  utm: string;
  contrat: ContratType;
  objectif: number;
  email: string;
  comm_rules: CommissionRule[];
}

const emptyForm = (): NewPartnerForm => ({
  identifiant: "",
  nom: "",
  type: "cgp",
  utm: "",
  contrat: "affiliation",
  objectif: 100,
  email: "",
  comm_rules: DEFAULT_COMM_RULES,
});

export default function PartnersTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPartnerForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Partner>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async () => {
    setError("");
    try {
      await createPartner.mutateAsync({
        nom: form.nom,
        email: form.email,
        type: form.type,
        contrat: form.contrat,
        utm: form.utm || slug(form.nom),
        code: form.identifiant || slug(form.nom),
        comm_obj_annuel: form.objectif,
        comm_rules: form.comm_rules,
      });
      setSuccess("Partenaire cree et synchronise HubSpot");
      setShowCreate(false);
      setForm(emptyForm());
    } catch {
      setError("Erreur lors de la creation");
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    try {
      await updatePartner.mutateAsync({
        id: partner.id,
        active: !partner.active,
      });
    } catch {
      setError("Erreur lors de la mise a jour");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updatePartner.mutateAsync({ id, ...editForm });
      setEditingId(null);
      setEditForm({});
      setSuccess("Partenaire mis a jour");
    } catch {
      setError("Erreur lors de la mise a jour");
    }
  };

  const startEdit = (p: Partner) => {
    setEditingId(p.id);
    setEditForm({
      nom: p.nom,
      email: p.email,
      type: p.type,
      contrat: p.contrat,
      utm: p.utm,
      code: p.code,
      comm_obj_annuel: p.comm_obj_annuel,
      comm_rules: p.comm_rules,
    });
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <Check className="size-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Partenaires</h3>
          <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855]">
            {partners.length}
          </Badge>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className={showCreate ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : ""}
        >
          {showCreate ? (
            <>
              <X className="size-4 mr-1.5" />
              Annuler
            </>
          ) : (
            <>
              <UserPlus className="size-4 mr-1.5" />
              Nouveau partenaire
            </>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-[#F6CCA4]/60 bg-[#FFFCF8]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4 text-[#B8864E]" />
              Creer un partenaire
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <Label>Identifiant (code)</Label>
                <Input
                  value={form.identifiant}
                  onChange={(e) => setForm({ ...form, identifiant: e.target.value })}
                  placeholder={slug(form.nom) || "auto-genere"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  placeholder="Nom du partenaire"
                />
              </div>
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PartnerType })}
                options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <div className="space-y-1.5">
                <Label>UTM source</Label>
                <Input
                  value={form.utm}
                  onChange={(e) => setForm({ ...form, utm: e.target.value })}
                  placeholder={slug(form.nom) || "auto-genere"}
                />
              </div>
              <Select
                label="Contrat"
                value={form.contrat}
                onChange={(e) => setForm({ ...form, contrat: e.target.value as ContratType })}
                options={CONTRAT_OPTIONS}
              />
              <div className="space-y-1.5">
                <Label>Objectif annuel</Label>
                <Input
                  type="number"
                  value={form.objectif}
                  onChange={(e) => setForm({ ...form, objectif: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@partenaire.com"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <CommissionEditor
              rules={form.comm_rules}
              onChange={(rules) => setForm({ ...form, comm_rules: rules })}
            />

            <div className="mt-6">
              <Button
                className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                onClick={handleCreate}
                disabled={createPartner.isPending || !form.nom}
              >
                {createPartner.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Creation...
                  </>
                ) : (
                  "Creer + Synchroniser HubSpot"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partners list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="size-6 text-[#0A3855] animate-spin" />
          <p className="text-sm text-gray-400">Chargement des partenaires...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => {
            const commission = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
            const isEditing = editingId === p.id;

            return (
              <Card key={p.id} className="transition-shadow hover:shadow-md">
                <CardContent>
                  {/* Summary row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Status dot */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ${
                        p.active
                          ? "bg-emerald-500 ring-emerald-500/20"
                          : "bg-red-400 ring-red-400/20"
                      }`}
                    />

                    <span className="font-semibold text-gray-900 min-w-[120px]">{p.nom}</span>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">
                      {p.code}
                    </span>
                    <span className="text-xs text-gray-400">utm: {p.utm}</span>

                    <Separator orientation="vertical" className="h-4 mx-1" />

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{p.leads} leads</span>
                      <span className="text-gray-300">|</span>
                      <span>{p.abonnes} abonnes</span>
                      <span className="text-gray-300">|</span>
                      <span className="font-semibold text-[#0A3855]">{commission.total} EUR</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-1">
                      <Badge
                        variant="secondary"
                        className={
                          p.type === "cgp"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : p.type === "agence-immo"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }
                      >
                        {p.type}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          p.contrat === "affiliation"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200"
                        }
                      >
                        {p.contrat === "affiliation" ? "AF" : "MB"}
                      </Badge>
                      <Badge
                        variant={p.active ? "secondary" : "destructive"}
                        className={
                          p.active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : undefined
                        }
                      >
                        {p.active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>

                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => (isEditing ? setEditingId(null) : startEdit(p))}
                      >
                        {isEditing ? (
                          <>
                            <ChevronUp className="size-3.5 mr-1" />
                            Fermer
                          </>
                        ) : (
                          <>
                            <Pencil className="size-3.5 mr-1" />
                            Modifier
                          </>
                        )}
                      </Button>
                      <Button
                        variant={p.active ? "destructive" : "default"}
                        size="sm"
                        className={
                          !p.active ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                        }
                        onClick={() => handleToggleActive(p)}
                      >
                        {p.active ? (
                          <>
                            <PowerOff className="size-3.5 mr-1" />
                            Desactiver
                          </>
                        ) : (
                          <>
                            <Power className="size-3.5 mr-1" />
                            Activer
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="space-y-1.5">
                          <Label>Nom</Label>
                          <Input
                            value={editForm.nom ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={editForm.email ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, email: e.target.value })
                            }
                          />
                        </div>
                        <Select
                          label="Type"
                          value={editForm.type ?? p.type}
                          onChange={(e) =>
                            setEditForm({ ...editForm, type: e.target.value as PartnerType })
                          }
                          options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
                        />
                        <div className="space-y-1.5">
                          <Label>UTM</Label>
                          <Input
                            value={editForm.utm ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, utm: e.target.value })
                            }
                          />
                        </div>
                        <Select
                          label="Contrat"
                          value={editForm.contrat ?? p.contrat}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              contrat: e.target.value as ContratType,
                            })
                          }
                          options={CONTRAT_OPTIONS}
                        />
                        <div className="space-y-1.5">
                          <Label>Objectif annuel</Label>
                          <Input
                            type="number"
                            value={editForm.comm_obj_annuel ?? 0}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                comm_obj_annuel: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <CommissionEditor
                        rules={editForm.comm_rules ?? p.comm_rules}
                        onChange={(rules) =>
                          setEditForm({ ...editForm, comm_rules: rules })
                        }
                        abonnes={p.abonnes}
                        biensMoyens={p.biens_moyens}
                        caParClient={p.ca_par_client}
                      />

                      <div className="mt-6 flex gap-2">
                        <Button onClick={() => handleUpdate(p.id)}>
                          <Check className="size-4 mr-1.5" />
                          Sauvegarder
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* HubSpot values reference */}
      <Card className="bg-gray-50/50">
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Info className="size-4 text-gray-400" />
            <p className="text-xs font-medium text-gray-500">
              Valeurs HubSpot partenaire__lead_
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Abonne", "Payeur", "Non payeur"].map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="font-mono text-[11px]"
              >
                partenaire__lead_{v.toLowerCase().replace(/\s/g, "_")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
