"use client";

import { useState } from "react";
import type { Partner, CommissionRule, ContratType, PartnerType } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { calcCommission, DEFAULT_TRANCHES } from "@/services/commission";
import { slug } from "@/services/links";
import { useAdminPartners, useCreatePartner, useUpdatePartner, useAdminLeads } from "@/hooks/useAdminData";
import { STAGE_STYLES } from "@/services/constants";
import type { LeadStage } from "@/types";
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
  Eye,
  Search,
  Link2,
  LogIn,
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
  sendEmail: boolean;
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
  sendEmail: false,
});

function LeadsPanel({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const { data: leads = [], isLoading } = useAdminLeads(partnerId);
  const [leadSearch, setLeadSearch] = useState("");

  const filteredLeads = leads.filter((l) => {
    if (!leadSearch.trim()) return true;
    const q = leadSearch.toLowerCase();
    return l.nom.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  const stageBadge = (stage: LeadStage) => {
    const s = STAGE_STYLES[stage] || STAGE_STYLES["Non payeur"];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.text === "text-green-700" ? "bg-green-500" : s.text === "text-blue-700" ? "bg-blue-500" : "bg-gray-400"}`} />
        {stage}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 text-[#0A3855] animate-spin" />
        <span className="ml-2 text-sm text-gray-400">Chargement des leads...</span>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">Aucun lead pour {partnerName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Rechercher un lead (nom, email)..."
        value={leadSearch}
        onChange={(e) => setLeadSearch(e.target.value)}
        className="max-w-sm text-xs"
      />
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#E5EDF1]/40">
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Nom</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Email</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Statut</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Source</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-center">Biens</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Date HubSpot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-[#E5EDF1]/20 transition-colors">
                <td className="px-3 py-2 text-xs font-semibold text-gray-900">{lead.nom}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{lead.email}</td>
                <td className="px-3 py-2">{stageBadge(lead.stage)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    {lead.source}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 text-center tabular-nums">{lead.biens}</td>
                <td className="px-3 py-2 text-[10px] text-gray-400">
                  {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">
                  Aucun lead correspondant
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PartnersTab() {
  const { data: partners = [], isLoading: loading } = useAdminPartners();
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPartnerForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Partner>>({});
  const [viewingLeadsId, setViewingLeadsId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [linkLoading, setLinkLoading] = useState<string | null>(null);

  const filteredPartners = partners.filter((p) => {
    if (!partnerSearch.trim()) return true;
    const q = partnerSearch.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.utm || "").toLowerCase().includes(q) ||
      (p.code || "").toLowerCase().includes(q)
    );
  });

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
        sendEmail: form.sendEmail,
      });
      setSuccess(form.sendEmail ? "Partenaire créé — email de bienvenue envoyé" : "Partenaire créé et synchronisé HubSpot");
      setShowCreate(false);
      setForm(emptyForm());
    } catch {
      setError("Erreur lors de la creation");
    }
  };

  const handleGetLink = async (partnerId: string, open: boolean) => {
    setLinkLoading(partnerId + (open ? "-open" : "-send"));
    setError("");
    try {
      const res = await fetch("/api/admin/partner-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, sendEmail: !open }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error || "Erreur");
      if (open) {
        window.open(json.link, "_blank");
      } else {
        setSuccess(json.emailError ? `Lien généré mais email non envoyé : ${json.emailError}` : "Email de connexion envoyé");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la génération du lien");
    } finally {
      setLinkLoading(null);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Partenaires</h3>
          <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855]">
            {filteredPartners.length}/{partners.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher partenaire..."
            value={partnerSearch}
            onChange={(e) => setPartnerSearch(e.target.value)}
            className="w-56 text-xs"
          />
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
                <Label>Code promo</Label>
                <Input
                  value={form.identifiant}
                  onChange={(e) => setForm({ ...form, identifiant: e.target.value })}
                  placeholder="ex: DUPONT20 (optionnel)"
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
              <div className="flex items-center gap-2 self-end pb-1">
                <input
                  id="sendEmail"
                  type="checkbox"
                  checked={form.sendEmail}
                  onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 accent-[#0A3855]"
                />
                <label htmlFor="sendEmail" className="text-sm text-gray-600 cursor-pointer select-none">
                  Envoyer email de bienvenue
                </label>
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
          {filteredPartners.map((p) => {
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

                    <div className="ml-auto flex gap-2 flex-wrap">
                      {p.email && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGetLink(p.id, false)}
                            disabled={linkLoading === p.id + "-send"}
                            title="Envoyer un email avec lien de connexion"
                          >
                            {linkLoading === p.id + "-send" ? (
                              <><Loader2 className="size-3.5 mr-1 animate-spin" /> Envoi...</>
                            ) : (
                              <><Link2 className="size-3.5 mr-1" /> Lien de connexion</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGetLink(p.id, true)}
                            disabled={linkLoading === p.id + "-open"}
                            title="Accéder au portail en tant que ce partenaire"
                          >
                            {linkLoading === p.id + "-open" ? (
                              <><Loader2 className="size-3.5 mr-1 animate-spin" /> Ouverture...</>
                            ) : (
                              <><LogIn className="size-3.5 mr-1" /> Accéder</>
                            )}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingLeadsId(viewingLeadsId === p.id ? null : p.id)}
                        className={viewingLeadsId === p.id ? "bg-[#E5EDF1] text-[#0A3855]" : ""}
                      >
                        <Eye className="size-3.5 mr-1" />
                        Leads
                      </Button>
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

                  {/* Leads panel */}
                  {viewingLeadsId === p.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Eye className="size-4 text-[#0A3855]" />
                        <h4 className="text-sm font-semibold text-gray-900">Leads de {p.nom}</h4>
                        <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-[10px]">
                          {p.leads} leads
                        </Badge>
                      </div>
                      <LeadsPanel partnerId={p.id} partnerName={p.nom} />
                    </div>
                  )}

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
