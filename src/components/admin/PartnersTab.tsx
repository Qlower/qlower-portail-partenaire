"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Partner, CommissionRule, ContratType, PartnerType, PartnerStatut } from "@/types";
import { PARTNER_TYPES } from "@/services/constants";
import { DEFAULT_TRANCHES } from "@/services/commission";
import { slug } from "@/services/links";
import { useAdminPartners, useCreatePartner, useUpdatePartner, useDeletePartner, useAdminLeads } from "@/hooks/useAdminData";
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
  Mail,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const STATUT_OPTIONS = [
  { value: "en_attente", label: "En attente" },
  { value: "contrat_envoye", label: "Contrat envoyé" },
  { value: "actif", label: "Actif" },
  { value: "suspendu", label: "Suspendu" },
];

const STATUT_STYLES: Record<string, { bg: string; text: string }> = {
  en_attente: { bg: "bg-amber-50", text: "text-amber-700 border border-amber-200" },
  contrat_envoye: { bg: "bg-blue-50", text: "text-blue-700 border border-blue-200" },
  actif: { bg: "bg-emerald-50", text: "text-emerald-700 border border-emerald-200" },
  suspendu: { bg: "bg-red-50", text: "text-red-700 border border-red-200" },
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  contrat_envoye: "Contrat envoyé",
  actif: "Actif",
  suspendu: "Suspendu",
};

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
  contact_prenom: string;
  contact_nom: string;
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
  contact_prenom: "",
  contact_nom: "",
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
    return l.nom.toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q);
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
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Recommandé le</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-[#0A3855]/60 uppercase tracking-wider text-left">Abonné depuis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLeads.map((lead) => (
              <tr
                key={lead.id}
                className={`hover:bg-[#E5EDF1]/20 transition-colors ${lead.hs_deleted ? "opacity-70" : ""}`}
              >
                <td className="px-3 py-2 text-xs font-semibold text-gray-900">
                  <div className="flex items-center gap-1.5">
                    <span className={lead.hs_deleted ? "text-gray-400 italic" : ""}>{lead.nom}</span>
                    {lead.hs_deleted && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-200"
                        title={
                          lead.hs_deleted_at
                            ? `Supprimé le ${new Date(lead.hs_deleted_at).toLocaleDateString("fr-FR")}`
                            : "Compte supprimé (droit à l'effacement)"
                        }
                      >
                        Supprimé
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  <span className={lead.hs_deleted ? "italic text-gray-400" : ""}>{lead.email || "—"}</span>
                </td>
                <td className="px-3 py-2">{stageBadge(lead.stage)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    {lead.source}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-400">
                  {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-3 py-2 text-[10px]">
                  {(() => {
                    const displayDate = lead.first_paid_at || lead.subscribed_at;
                    if (!displayDate) return <span className="text-gray-300">—</span>;
                    const mainD = new Date(displayDate);
                    const subD = lead.subscribed_at ? new Date(lead.subscribed_at) : null;
                    const unsubD = lead.unsubscribed_at ? new Date(lead.unsubscribed_at) : null;
                    // Detect HubSpot glitch (entry/exit < 60s apart)
                    const isGlitch = !!(subD && unsubD && Math.abs(subD.getTime() - unsubD.getTime()) < 60000);
                    const isResub = !isGlitch && lead.stage === "Abonne" && unsubD && subD && unsubD < subD;
                    const isReallyUnsub = !isGlitch && lead.stage !== "Abonne" && unsubD && unsubD >= mainD;
                    return (
                      <div className="flex flex-col leading-tight">
                        <span className="text-gray-600 font-medium">
                          {mainD.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {isReallyUnsub && unsubD && (
                          <span className="text-orange-600" title={`Désabonné le ${unsubD.toLocaleDateString("fr-FR")}`}>
                            Désabo {unsubD.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                        {isResub && !isReallyUnsub && unsubD && (
                          <span className="text-blue-600" title={`Ancien désabo ${unsubD.toLocaleDateString("fr-FR")} — réabonné`}>
                            Réabo
                          </span>
                        )}
                      </div>
                    );
                  })()}
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

  // Live commission data — same logic as partner dashboard (HubSpot live + rules per year)
  type CommSummary = { partnerId: string; totalSubscribers: number; totalCommission: number };
  const { data: commSummaries = [] } = useQuery<CommSummary[]>({
    queryKey: ["admin-partners-commissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/partners-commissions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  const commByPartner = new Map(commSummaries.map((c) => [c.partnerId, c]));
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const deletePartner = useDeletePartner();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<NewPartnerForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Partner>>({});
  const [viewingLeadsId, setViewingLeadsId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [linkLoading, setLinkLoading] = useState<string | null>(null);
  const [confirmAccess, setConfirmAccess] = useState<Partner | null>(null);

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
      const partnerSlug = slug(form.nom);
      const partnerId = `${partnerSlug}-${Date.now().toString().slice(-4)}`;
      await createPartner.mutateAsync({
        id: partnerId,
        nom: form.nom,
        contact_prenom: form.contact_prenom,
        contact_nom: form.contact_nom,
        email: form.email,
        type: form.type,
        contrat: form.contrat,
        utm: form.utm || partnerSlug,
        code: form.identifiant || partnerSlug,
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

  const handleSendEmail = async (partnerId: string) => {
    setLinkLoading(partnerId + "-send");
    setError("");
    try {
      const res = await fetch("/api/admin/partner-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, sendEmail: true }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error || "Erreur");
      setSuccess(json.emailError ? `Erreur Resend : ${json.emailError}` : "Email d'accès envoyé au partenaire");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setLinkLoading(null);
    }
  };

  const handleImpersonate = (partnerId: string) => {
    window.open(`/dashboard?as=${partnerId}`, "_blank");
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePartner.mutateAsync(id);
      setConfirmDeleteId(null);
      setSuccess("Partenaire supprimé");
    } catch {
      setError("Erreur lors de la suppression");
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
      contact_prenom: p.contact_prenom,
      contact_nom: p.contact_nom,
      email: p.email,
      type: p.type,
      contrat: p.contrat,
      utm: p.utm,
      code: p.code,
      comm_obj_annuel: p.comm_obj_annuel,
      comm_rules: p.comm_rules,
      statut: p.statut,
      metier: p.metier,
      siret: p.siret,
      tva: p.tva,
      adresse: p.adresse,
      ville: p.ville,
      code_postal: p.code_postal,
      telephone: p.telephone,
      iban: p.iban,
      bic: p.bic,
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
                <Label>Entreprise</Label>
                <Input
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prenom du contact</Label>
                <Input
                  value={form.contact_prenom}
                  onChange={(e) => setForm({ ...form, contact_prenom: e.target.value })}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom du contact</Label>
                <Input
                  value={form.contact_nom}
                  onChange={(e) => setForm({ ...form, contact_nom: e.target.value })}
                  placeholder="Dupont"
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
            const live = commByPartner.get(p.id);
            const displayAbonnes = live?.totalSubscribers ?? p.abonnes;
            const displayCommission = live?.totalCommission ?? 0;
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
                      <span>{displayAbonnes} abonnes</span>
                      <span className="text-gray-300">|</span>
                      <span
                        className="font-semibold text-[#0A3855]"
                        title="Cumul commission (vue partenaire — règles appliquées année par année)"
                      >
                        {displayCommission} EUR
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-1">
                      <Badge
                        variant="secondary"
                        title={`Type de partenaire : ${p.type}`}
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
                        title={`Contrat : ${p.contrat === "affiliation" ? "Affiliation" : "Marque blanche"}`}
                        className={
                          p.contrat === "affiliation"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200"
                        }
                      >
                        {p.contrat === "affiliation" ? "AF" : "MB"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        title={`Statut : ${STATUT_LABELS[p.statut] || p.statut || "Inconnu"}`}
                        className={`${STATUT_STYLES[p.statut]?.bg || "bg-gray-50"} ${STATUT_STYLES[p.statut]?.text || "text-gray-500 border border-gray-200"}`}
                      >
                        {STATUT_LABELS[p.statut] || p.statut || "—"}
                      </Badge>
                      <button
                        title={p.statut === "actif" ? "Compte actif — cliquer pour désactiver" : "Compte inactif — cliquer pour activer"}
                        className="inline-flex items-center gap-1.5 cursor-pointer"
                        onClick={() => updatePartner.mutateAsync({
                          id: p.id,
                          statut: (p.statut === "actif" ? "suspendu" : "actif") as PartnerStatut,
                        })}
                      >
                        <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${p.statut === "actif" ? "bg-green-500" : "bg-red-400"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${p.statut === "actif" ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                        </div>
                        <span className={`text-xs font-medium ${p.statut === "actif" ? "text-green-700" : "text-red-600"}`}>
                          {p.statut === "actif" ? "Actif" : "Inactif"}
                        </span>
                      </button>
                    </div>

                    <div className="ml-auto flex gap-2 flex-wrap">
                      {p.email && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmAccess(p)}
                              disabled={!!linkLoading}
                              title={`Envoyer un lien de connexion à ${p.email}`}
                            >
                              {linkLoading === p.id + "-send" ? (
                                <><Loader2 className="size-3.5 mr-1 animate-spin" /> Envoi...</>
                              ) : (
                                <><Mail className="size-3.5 mr-1" /> Envoyer l&apos;accès</>
                              )}
                            </Button>
                            {p.lien_envoye_le && (
                              <span className="text-[10px] text-gray-400" title={`Dernier envoi : ${new Date(p.lien_envoye_le).toLocaleString("fr-FR")}`}>
                                <CheckCircle2 className="size-3 inline text-green-500 mr-0.5" />
                                {new Date(p.lien_envoye_le).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleImpersonate(p.id)}
                            title="Voir le portail en tant que ce partenaire"
                          >
                            <Eye className="size-3.5 mr-1" /> Voir comme partenaire
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
                      {confirmDeleteId === p.id ? (
                        <div className="flex items-center gap-1.5 ml-1 px-2 py-1 bg-red-50 rounded-md border border-red-200">
                          <span className="text-xs text-red-700">Supprimer ?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleDelete(p.id)}
                            disabled={deletePartner.isPending}
                          >
                            {deletePartner.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Oui"
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Non
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConfirmDeleteId(p.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
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
                          <Label>Entreprise</Label>
                          <Input
                            value={editForm.nom ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Prenom du contact</Label>
                          <Input
                            value={editForm.contact_prenom ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, contact_prenom: e.target.value })
                            }
                            placeholder="Jean"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Nom du contact</Label>
                          <Input
                            value={editForm.contact_nom ?? ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, contact_nom: e.target.value })
                            }
                            placeholder="Dupont"
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
                        <Select
                          label="Statut"
                          value={(editForm.statut as string) ?? p.statut ?? "en_attente"}
                          onChange={(e) =>
                            setEditForm({ ...editForm, statut: e.target.value as PartnerStatut })
                          }
                          options={STATUT_OPTIONS}
                        />
                      </div>

                      {/* Informations société */}
                      <Separator className="my-4" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations société</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="space-y-1.5">
                          <Label>Métier</Label>
                          <Input
                            value={(editForm.metier as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, metier: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>SIRET</Label>
                          <Input
                            value={(editForm.siret as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, siret: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>N° TVA</Label>
                          <Input
                            value={(editForm.tva as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, tva: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Adresse</Label>
                          <Input
                            value={(editForm.adresse as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ville</Label>
                          <Input
                            value={(editForm.ville as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, ville: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Code postal</Label>
                          <Input
                            value={(editForm.code_postal as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, code_postal: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Téléphone</Label>
                          <Input
                            value={(editForm.telephone as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>IBAN</Label>
                          <Input
                            value={(editForm.iban as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, iban: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>BIC</Label>
                          <Input
                            value={(editForm.bic as string) ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, bic: e.target.value })}
                          />
                        </div>
                        {p.kbis_url && (
                          <div className="space-y-1.5">
                            <Label>Kbis</Label>
                            <a href={p.kbis_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-[#0A3855] hover:underline font-medium">
                              Voir le document →
                            </a>
                          </div>
                        )}
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

      {/* Confirmation modal: Envoyer l'accès */}
      {confirmAccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!linkLoading) setConfirmAccess(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="bg-[#FFF6EC] p-2 rounded-full">
                <Mail className="size-5 text-[#B8864E]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Envoyer l&apos;email d&apos;accès ?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Un lien de connexion magique va être envoyé à :
                </p>
                <p className="text-sm font-mono font-semibold text-[#0A3855] mt-2 bg-gray-50 p-2 rounded break-all">
                  {confirmAccess.email || "(aucun email renseigné)"}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Partenaire : <strong>{confirmAccess.nom}</strong>
                </p>
                {confirmAccess.lien_envoye_le && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    <span>
                      Un accès a déjà été envoyé le{" "}
                      {new Date(confirmAccess.lien_envoye_le).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                variant="ghost"
                onClick={() => setConfirmAccess(null)}
                disabled={!!linkLoading}
              >
                Annuler
              </Button>
              <Button
                className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                onClick={async () => {
                  const id = confirmAccess.id;
                  await handleSendEmail(id);
                  setConfirmAccess(null);
                }}
                disabled={!confirmAccess.email || !!linkLoading}
              >
                {linkLoading === confirmAccess.id + "-send" ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-1.5" />
                    Confirmer &amp; envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
