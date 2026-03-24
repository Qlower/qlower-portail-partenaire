"use client";

import { useState, useEffect, useCallback } from "react";
import type { Partner, CommissionRule, ContratType, PartnerType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { calcCommission, DEFAULT_TRANCHES } from "@/services/commission";
import { slug } from "@/services/links";
import { api } from "@/lib/axios";
import { Card, Button, Input, Select, Badge, Alert, AlertDescription, Label } from "@/components/ui";
import CommissionEditor from "./CommissionEditor";

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
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPartnerForm>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Partner>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/partners");
      setPartners(res.data);
    } catch {
      setError("Erreur lors du chargement des partenaires");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      await api.post("/admin/partners", {
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
      fetchPartners();
    } catch {
      setError("Erreur lors de la creation");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    try {
      await api.patch(`/admin/partners`, {
        id: partner.id,
        active: !partner.active,
      });
      fetchPartners();
    } catch {
      setError("Erreur lors de la mise a jour");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.patch(`/admin/partners`, { id, ...editForm });
      setEditingId(null);
      setEditForm({});
      setSuccess("Partenaire mis a jour");
      fetchPartners();
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
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Partenaires ({partners.length})</h3>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Annuler" : "Nouveau partenaire"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-2 border-[#F6CCA4]">
          <h4 className="font-semibold text-gray-900 mb-4">Creer un partenaire</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <Label>Identifiant (code)</Label>
              <Input
                value={form.identifiant}
                onChange={(e) => setForm({ ...form, identifiant: e.target.value })}
                placeholder={slug(form.nom) || "auto-genere"}
              />
            </div>
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
              <Label>Objectif annuel</Label>
              <Input
                type="number"
                value={form.objectif}
                onChange={(e) => setForm({ ...form, objectif: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@partenaire.com"
              />
            </div>
          </div>

          <CommissionEditor
            rules={form.comm_rules}
            onChange={(rules) => setForm({ ...form, comm_rules: rules })}
          />

          <div className="mt-4">
            <Button className="bg-[#F6CCA4] text-[#1C1C1C] hover:bg-[#F5C89A]" onClick={handleCreate} disabled={creating || !form.nom}>
              {creating ? "Creation..." : "Creer + Synchroniser HubSpot"}
            </Button>
          </div>
        </Card>
      )}

      {/* Partners list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map((p) => {
            const commission = calcCommission(p.comm_rules, p.abonnes, p.biens_moyens, p.ca_par_client);
            const isEditing = editingId === p.id;

            return (
              <Card key={p.id} size="sm">
                {/* Summary row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status dot */}
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      p.active ? "bg-green-500" : "bg-red-400"
                    }`}
                  />

                  <span className="font-semibold text-gray-900 min-w-[120px]">{p.nom}</span>
                  <span className="text-xs text-gray-400 font-mono">{p.code}</span>
                  <span className="text-xs text-gray-400">utm: {p.utm}</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">{p.leads} leads</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-500">{p.abonnes} abonnes</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs font-semibold text-[#0A3855]">{commission.total} EUR</span>
                  </div>

                  <Badge variant="secondary" className={p.type === "cgp" ? "bg-blue-100 text-blue-800" : p.type === "agence-immo" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800"}>
                    {p.type}
                  </Badge>
                  <Badge variant="secondary" className={p.contrat === "affiliation" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}>
                    {p.contrat === "affiliation" ? "AF" : "MB"}
                  </Badge>
                  <Badge variant={p.active ? "default" : "destructive"} className={p.active ? "bg-green-100 text-green-800" : undefined}>
                    {p.active ? "Actif" : "Inactif"}
                  </Badge>

                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => (isEditing ? setEditingId(null) : startEdit(p))}
                    >
                      {isEditing ? "Fermer" : "Modifier"}
                    </Button>
                    <Button
                      variant={p.active ? "destructive" : "default"}
                      className={`text-xs ${!p.active ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.active ? "Desactiver" : "Activer"}
                    </Button>
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="flex flex-col gap-1">
                        <Label>Nom</Label>
                        <Input
                          value={editForm.nom ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editForm.email ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <Select
                        label="Type"
                        value={editForm.type ?? p.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value as PartnerType })}
                        options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))}
                      />
                      <div className="flex flex-col gap-1">
                        <Label>UTM</Label>
                        <Input
                          value={editForm.utm ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, utm: e.target.value })}
                        />
                      </div>
                      <Select
                        label="Contrat"
                        value={editForm.contrat ?? p.contrat}
                        onChange={(e) =>
                          setEditForm({ ...editForm, contrat: e.target.value as ContratType })
                        }
                        options={CONTRAT_OPTIONS}
                      />
                      <div className="flex flex-col gap-1">
                        <Label>Objectif annuel</Label>
                        <Input
                          type="number"
                          value={editForm.comm_obj_annuel ?? 0}
                          onChange={(e) =>
                            setEditForm({ ...editForm, comm_obj_annuel: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    <CommissionEditor
                      rules={editForm.comm_rules ?? p.comm_rules}
                      onChange={(rules) => setEditForm({ ...editForm, comm_rules: rules })}
                      abonnes={p.abonnes}
                      biensMoyens={p.biens_moyens}
                      caParClient={p.ca_par_client}
                    />

                    <div className="mt-4 flex gap-2">
                      <Button onClick={() => handleUpdate(p.id)}>Sauvegarder</Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* HubSpot values reference */}
      <Card size="sm" className="bg-gray-50">
        <p className="text-xs font-medium text-gray-500 mb-2">Valeurs HubSpot partenaire__lead_</p>
        <div className="flex flex-wrap gap-2">
          {["Abonne", "Payeur", "Non payeur"].map((v) => (
            <Badge key={v} variant="secondary" className="bg-gray-100 text-gray-800">
              partenaire__lead_{v.toLowerCase().replace(/\s/g, "_")}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
