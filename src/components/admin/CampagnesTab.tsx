"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Partner, ContratType } from "@/types";
import { useAdminPartners, useEmailTemplates, useUpdateEmailTemplate } from "@/hooks/useAdminData";
import type { EmailTemplate } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select-custom";
import BlockEditor, { type BlockEditorHandle } from "./BlockEditor";
import TemplateVersionsPanel from "./TemplateVersionsPanel";
import {
  Loader2,
  Target,
  FileText,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Info,
  Mail,
  Save,
  Check,
  X,
  AlertTriangle,
  User,
  Link2,
  Hash,
  TrendingUp,
  Lock,
  Plus,
  Camera,
} from "lucide-react";

type Audience = "tous" | "affiliation" | "marque_blanche";

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── Variables disponibles dans les templates ──────────────────────────────
// Chaque variable expose un label humain (FR), une icône et un placeholder
// d'aperçu pour montrer ce que ça donnera dans le mail final.
type VarKey = "nom" | "email" | "code" | "utm" | "leads" | "abonnes" | "link" | "setup_link" | "magic_link";

interface VarDef {
  key: VarKey;
  label: string;          // affiché sur le bouton
  description: string;    // tooltip
  icon: typeof User;
  exampleHint: string;    // ce qui sera substitué (ex: "Cocoonr")
}

const AVAILABLE_VARS: VarDef[] = [
  { key: "nom",         label: "Nom du partenaire",    description: "Raison sociale (ex: Cocoonr)",            icon: User,        exampleHint: "Cocoonr" },
  { key: "email",       label: "Email",                description: "Email du partenaire",                     icon: Mail,        exampleHint: "contact@cocoonr.fr" },
  { key: "code",        label: "Code promo",           description: "Code promo Stripe (ex: COCOONR)",         icon: Hash,        exampleHint: "COCOONR" },
  { key: "utm",         label: "UTM",                  description: "Identifiant UTM utilisé dans les liens",  icon: Hash,        exampleHint: "Cocoonr" },
  { key: "leads",       label: "Nb leads",             description: "Nombre total de leads apportés",          icon: TrendingUp,  exampleHint: "78" },
  { key: "abonnes",     label: "Nb abonnés",           description: "Nombre d'abonnés actifs apportés",        icon: TrendingUp,  exampleHint: "35" },
  { key: "link",        label: "Lien d'affiliation",   description: "Lien tracké avec UTM + code promo",       icon: Link2,       exampleHint: "https://www.qlower.com/qlower-x-partenaire?utm_source=..." },
  { key: "setup_link",  label: "Lien connexion 7j",    description: "Lien d'accès sécurisé valable 7 jours",   icon: Lock,        exampleHint: "(généré à l'envoi, 7 jours)" },
  { key: "magic_link",  label: "Lien magique 24h",     description: "Lien magique Supabase, valable 24h",      icon: Lock,        exampleHint: "(généré à l'envoi, 24h)" },
];

const VALID_KEYS = new Set<string>(AVAILABLE_VARS.map((v) => v.key));

// Extrait toutes les {{xxx}} du texte (valides ou pas)
function extractUsedVars(text: string): Array<{ key: string; valid: boolean }> {
  const found = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) found.add(m[1]);
  return [...found].map((k) => ({ key: k, valid: VALID_KEYS.has(k) }));
}

type CampaignSend = {
  id: string;
  template_id: string | null;
  subject: string;
  body: string;
  partner_ids: string[];
  partner_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string;
  recipients: Array<{ id: string; nom: string }>;
};

export default function CampagnesTab() {
  const { data: partners = [], isLoading: loadingPartners } = useAdminPartners();
  const { data: templates = [], isLoading: loadingTemplates } = useEmailTemplates();
  const updateTemplate = useUpdateEmailTemplate();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<Audience>("tous");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [sentPartners, setSentPartners] = useState<Set<string>>(new Set());
  const [allSent, setAllSent] = useState(false);
  const [sending, setSending] = useState(false);
  // Confirmation modal — pour éviter tout envoi accidentel.
  // L'utilisateur doit cliquer "Préparer l'envoi" → modal s'ouvre →
  // taper le nombre exact de destinataires → "Envoyer maintenant".
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTyped, setConfirmTyped] = useState("");

  // Editable fields
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saved, setSaved] = useState(false);

  const targeted = partners.filter((p) => {
    if (!p.active) return false;
    if (audience === "tous") return true;
    return p.contrat === (audience as ContratType);
  });

  const selected = targeted.filter((p) => !excludedIds.has(p.id));
  const template = templates.find((t) => t.id === selectedTemplateId);

  // When template changes, populate editable fields
  useEffect(() => {
    if (template) {
      setEditSubject(template.subject);
      setEditBody(template.body);
      setSaved(false);
    }
  }, [template?.id, template?.updated_at]);

  const previewPartner = selected[0];
  const previewVars: Record<string, string> = previewPartner
    ? {
        nom: previewPartner.nom,
        email: previewPartner.email || "",
        utm: previewPartner.utm,
        code: previewPartner.code,
        leads: String(previewPartner.leads ?? 0),
        abonnes: String(previewPartner.abonnes ?? 0),
        link: `https://www.qlower.com/qlower-x-partenaire?utm_source=${previewPartner.utm}&utm_medium=affiliation&utm_campaign=${previewPartner.code}`,
        magic_link: "https://partenaire.qlower.com/login (lien magique généré à l'envoi, valable 24h)",
      }
    : {};

  const togglePartner = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllSent(false);
    setSentPartners(new Set());
  };

  const selectAll = () => {
    setExcludedIds(new Set());
    setAllSent(false);
    setSentPartners(new Set());
  };

  const deselectAll = () => {
    setExcludedIds(new Set(targeted.map((p) => p.id)));
    setAllSent(false);
    setSentPartners(new Set());
  };

  // Sauvegarde standard (versionLabel=null → auto-save dans l'historique)
  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplateId,
        subject: editSubject,
        body: editBody,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Erreur lors de la sauvegarde du template.");
    }
  };

  // Sauvegarde avec un nom : prompt → archive l'état actuel sous ce nom AVANT
  // d'écraser avec le nouveau contenu. Permet à Coline de marquer un point
  // de repère facile à retrouver dans l'historique.
  const handleSaveTemplateWithName = async () => {
    if (!selectedTemplateId) return;
    const label = window.prompt(
      "Nom de cette version (pour la retrouver facilement plus tard) :\n\nEx: \"Avant refonte wording\", \"Validé par Alex\"",
      "",
    );
    if (label === null) return; // annulé
    if (!label.trim()) {
      alert("Le nom ne peut pas être vide.");
      return;
    }
    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplateId,
        subject: editSubject,
        body: editBody,
        versionLabel: label.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Erreur lors de la sauvegarde du template.");
    }
  };

  // Étape 1 : ouvre la modal (ne lance PAS l'envoi).
  const openConfirm = () => {
    if (!selectedTemplateId || selected.length === 0) return;
    setConfirmTyped("");
    setConfirmOpen(true);
  };

  // Étape 2 : la modal a fait taper le bon nombre + cliquer "Envoyer maintenant".
  // C'est SEULEMENT à ce moment-là que les emails partent.
  const handleSendAll = async () => {
    if (!selectedTemplateId || selected.length === 0) return;
    setConfirmOpen(false);
    setSending(true);
    try {
      // Save template first if modified
      if (template && (editSubject !== template.subject || editBody !== template.body)) {
        await updateTemplate.mutateAsync({
          id: selectedTemplateId,
          subject: editSubject,
          body: editBody,
        });
      }

      const res = await fetch("/api/admin/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: selectedTemplateId,
          partnerIds: selected.map((p) => p.id),
          confirm: true,
          expectedRecipientCount: selected.filter((p) => p.email).length,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Backend remonte maintenant un message précis (typiquement l'erreur Resend
        // du premier destinataire qui a échoué). On l'affiche tel quel.
        throw new Error(data.error || `Erreur serveur (HTTP ${res.status})`);
      }
      // Si certains ont échoué mais pas tous, on alerte sans bloquer
      type Failure = { email: string; error?: string };
      const failures = (data.failures as Failure[] | undefined) || [];
      const failed = (data.failed as number | undefined) || 0;
      const sent = (data.sent as number | undefined) || 0;
      if (failed > 0) {
        const firstErrs = failures
          .filter((f) => !!f.error)
          .slice(0, 3)
          .map((f) => `• ${f.email} — ${f.error}`)
          .join("\n");
        alert(
          `${sent} email(s) envoyé(s), ${failed} échec(s).\n\nPremières erreurs :\n${firstErrs || "(détail indisponible)"}`,
        );
      }
      const ids = new Set(selected.map((p) => p.id));
      setSentPartners(ids);
      setAllSent(true);
      // Refresh history list
      queryClient.invalidateQueries({ queryKey: ["campaign-history"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      alert(`Erreur lors de l'envoi des emails :\n\n${msg}`);
    } finally {
      setSending(false);
    }
  };

  if (loadingPartners || loadingTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="size-6 text-[#0A3855] animate-spin" />
        <p className="text-sm text-gray-400">Chargement des campagnes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ciblage */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-[#0A3855]" />
              Ciblage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Select
              label="Audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setExcludedIds(new Set());
                setAllSent(false);
                setSentPartners(new Set());
              }}
              options={[
                { value: "tous", label: "Tous les partenaires actifs" },
                { value: "affiliation", label: "Affiliation uniquement" },
                { value: "marque_blanche", label: "Marque blanche uniquement" },
              ]}
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  {selected.length}/{targeted.length} partenaire(s) sélectionné(s)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-[#0A3855] hover:underline font-medium"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-xs text-gray-500 hover:underline font-medium"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {targeted.map((p) => {
                  const isExcluded = excludedIds.has(p.id);
                  const isSent = sentPartners.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePartner(p.id)}
                      className="focus:outline-none"
                    >
                      <Badge
                        variant="secondary"
                        className={`cursor-pointer transition-all ${
                          isSent
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isExcluded
                            ? "bg-gray-100 text-gray-400 border border-gray-200 line-through opacity-60"
                            : "bg-[#E5EDF1] text-[#0A3855] border border-[#0A3855]/10 hover:bg-[#d5e3ea]"
                        }`}
                      >
                        {isSent && <CheckCircle2 className="size-3 mr-0.5" />}
                        {isExcluded && !isSent && <X className="size-3 mr-0.5" />}
                        {p.nom}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template selector */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#0A3855]" />
              Template
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplateId(t.id);
                    setShowPreview(false);
                    setAllSent(false);
                    setSentPartners(new Set());
                  }}
                  className={`text-left p-3.5 rounded-lg border-2 transition-all ${
                    selectedTemplateId === t.id
                      ? "border-[#0A3855] bg-[#E5EDF1]/30 ring-1 ring-[#0A3855]/10"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className={`size-3.5 ${selectedTemplateId === t.id ? "text-[#0A3855]" : "text-gray-400"}`} />
                    <p className={`text-sm font-medium ${selectedTemplateId === t.id ? "text-[#0A3855]" : "text-gray-900"}`}>
                      {t.title}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 ml-5.5">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template editor */}
      {selectedTemplateId && template && (
        <TemplateEditor
          template={template}
          editSubject={editSubject}
          setEditSubject={(v) => { setEditSubject(v); setSaved(false); }}
          editBody={editBody}
          setEditBody={(v) => { setEditBody(v); setSaved(false); }}
          previewVars={previewVars}
          previewPartnerName={previewPartner?.nom}
          saved={saved}
          saving={updateTemplate.isPending}
          onSave={handleSaveTemplate}
          onSaveWithName={handleSaveTemplateWithName}
        />
      )}

      {/* Preview & Send */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4 text-[#0A3855]" />
            Prévisualisation et envoi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {!selectedTemplateId ? (
            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                Sélectionnez un template pour prévisualiser.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={!previewPartner}
                >
                  {showPreview ? (
                    <><EyeOff className="size-4 mr-1.5" /> Masquer aperçu</>
                  ) : (
                    <><Eye className="size-4 mr-1.5" /> Prévisualiser</>
                  )}
                </Button>
                <Button
                  className="bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A]"
                  onClick={openConfirm}
                  disabled={selected.length === 0 || allSent || sending}
                >
                  {sending ? (
                    <><Loader2 className="size-4 mr-1.5 animate-spin" /> Envoi en cours...</>
                  ) : allSent ? (
                    <><CheckCircle2 className="size-4 mr-1.5" /> Envoyé à {selected.length} partenaire(s)</>
                  ) : (
                    <><Send className="size-4 mr-1.5" /> Préparer l&apos;envoi à {selected.length} partenaire(s)</>
                  )}
                </Button>
              </div>

              {/* Preview */}
              {showPreview && previewPartner && (
                <Card className="bg-[#F8FAFB] border-dashed">
                  <CardContent>
                    <p className="text-xs text-gray-400 mb-2">
                      Aperçu pour : {previewPartner.nom}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Objet : {replaceVars(editSubject, previewVars)}
                    </p>
                    <div
                      className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700"
                      dangerouslySetInnerHTML={{ __html: replaceVars(editBody, previewVars) }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Per-partner status */}
              <div className="space-y-2">
                {selected.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <span className="text-sm text-gray-700 font-medium">{p.nom}</span>
                    <div className="flex items-center gap-3">
                      {sentPartners.has(p.id) ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          <CheckCircle2 className="size-3 mr-0.5" />
                          Envoyé
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-gray-50 text-gray-500 border border-gray-200"
                        >
                          <Clock className="size-3 mr-0.5" />
                          En attente
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des envois */}
      <CampaignHistory />

      {/* Modal de double validation avant envoi */}
      {confirmOpen && template && (
        <ConfirmSendModal
          recipientCount={selected.length}
          subject={replaceVars(editSubject, previewVars)}
          previewBody={previewPartner ? replaceVars(editBody, previewVars) : editBody}
          previewPartnerName={previewPartner?.nom || "—"}
          recipients={selected.map((p) => ({ id: p.id, nom: p.nom, email: p.email || "—" }))}
          confirmTyped={confirmTyped}
          onConfirmTypedChange={setConfirmTyped}
          onCancel={() => { setConfirmOpen(false); setConfirmTyped(""); }}
          onConfirm={handleSendAll}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modal de confirmation d'envoi : type-to-confirm pour éviter tout envoi
// accidentel. Le bouton "Envoyer maintenant" reste désactivé tant que
// l'utilisateur n'a pas tapé le nombre exact de destinataires.
// ----------------------------------------------------------------------------
function ConfirmSendModal({
  recipientCount,
  subject,
  previewBody,
  previewPartnerName,
  recipients,
  confirmTyped,
  onConfirmTypedChange,
  onCancel,
  onConfirm,
}: {
  recipientCount: number;
  subject: string;
  previewBody: string;
  previewPartnerName: string;
  recipients: Array<{ id: string; nom: string; email: string }>;
  confirmTyped: string;
  onConfirmTypedChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = confirmTyped.trim() === String(recipientCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-amber-900">Confirmer l&apos;envoi de la campagne</h2>
            <p className="text-xs text-amber-700 mt-0.5">
              Cette action enverra un email réel à <strong>{recipientCount} partenaire{recipientCount > 1 ? "s" : ""}</strong>. Elle est irréversible.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Récap */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-24 shrink-0">Sujet</span>
              <span className="text-sm text-gray-900">{subject}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-24 shrink-0">Destinataires</span>
              <span className="text-sm text-gray-900">{recipientCount} partenaire{recipientCount > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-24 shrink-0">Aperçu</span>
              <span className="text-xs text-gray-500">Personnalisé pour : <strong>{previewPartnerName}</strong></span>
            </div>
          </div>

          {/* Liste des destinataires */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Liste des destinataires
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {recipients.map((r) => (
                  <span key={r.id} className="inline-block text-[11px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                    {r.nom}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Aperçu du contenu */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Aperçu du contenu (1er destinataire)
            </p>
            <div
              className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 max-h-60 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewBody }}
            />
          </div>

          {/* Type-to-confirm */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <Label className="text-amber-900 font-semibold">
              Pour confirmer, tape le nombre de destinataires : <span className="font-mono text-base">{recipientCount}</span>
            </Label>
            <Input
              autoFocus
              value={confirmTyped}
              onChange={(e) => onConfirmTypedChange(e.target.value)}
              placeholder={String(recipientCount)}
              className="mt-2 max-w-[200px]"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50/50">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="bg-[#0A3855] text-white hover:bg-[#0d4f78] disabled:opacity-50"
          >
            <Send className="size-4 mr-1.5" />
            Envoyer maintenant à {recipientCount} partenaire{recipientCount > 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CampaignHistory() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: history = [], isLoading } = useQuery<CampaignSend[]>({
    queryKey: ["campaign-history"],
    queryFn: async () => {
      const res = await fetch("/api/admin/campaign-history");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-[#0A3855]" />
          Historique des envois
          {history.length > 0 && (
            <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] ml-1">
              {history.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-[#0A3855]" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Aucune campagne envoyée pour le moment
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const isOpen = expandedId === h.id;
              const dt = new Date(h.sent_at);
              return (
                <div
                  key={h.id}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : h.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#E5EDF1]/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {h.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dt.toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        à {dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {" • "}
                        {h.sent_count} envoyé{h.sent_count > 1 ? "s" : ""}
                        {h.failed_count > 0 && ` • ${h.failed_count} échec${h.failed_count > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    {h.template_id && (
                      <Badge variant="secondary" className="bg-gray-50 text-gray-600 border border-gray-200 text-[10px] flex-shrink-0">
                        {h.template_id}
                      </Badge>
                    )}
                    <svg
                      className={`size-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                          Destinataires ({h.recipients.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {h.recipients.map((r) => (
                            <Badge
                              key={r.id}
                              variant="secondary"
                              className="bg-white border border-gray-200 text-gray-700 text-[10px] shadow-none"
                            >
                              {r.nom}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                          Sujet
                        </p>
                        <p className="text-xs text-gray-800 font-mono bg-white p-2 rounded border border-gray-100">
                          {h.subject}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                          Corps du mail (template avant personnalisation)
                        </p>
                        <div
                          className="text-xs bg-white p-3 rounded border border-gray-100 max-h-80 overflow-y-auto prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: h.body }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TemplateEditor — éditeur enrichi avec toolbar d'insertion de variables
// + détection live des variables utilisées (badges valides/invalides).
//
// Approche : on garde le textarea HTML brut (Coline peut toujours retoucher),
// mais on rajoute :
//   1. Une toolbar "Insérer" : boutons cliquables → insère la balise {{xxx}}
//      à la position du curseur (focus restauré derrière).
//   2. Une carte "Variables détectées" sous le textarea qui affiche en pills
//      colorés les variables utilisées, avec leur valeur d'aperçu pour le
//      premier partenaire de la sélection. Pill rouge si la balise est
//      incorrecte (typo type {{Nom}} ou {{xyz}}).
// ============================================================================
function TemplateEditor({
  template,
  editSubject,
  setEditSubject,
  editBody,
  setEditBody,
  previewVars,
  previewPartnerName,
  saved,
  saving,
  onSave,
  onSaveWithName,
}: {
  template: EmailTemplate;
  editSubject: string;
  setEditSubject: (v: string) => void;
  editBody: string;
  setEditBody: (v: string) => void;
  previewVars: Record<string, string>;
  previewPartnerName?: string;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onSaveWithName: () => void;
}) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const blockEditorRef = useRef<BlockEditorHandle>(null);
  // Le dernier champ focusé reçoit l'insertion via la toolbar :
  //   - "subject" → l'input objet
  //   - "body"    → un bloc dans l'éditeur (via API impérative)
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const insertVar = (key: VarKey) => {
    const placeholder = `{{${key}}}`;
    if (activeField === "subject") {
      const el = subjectRef.current;
      if (!el) {
        setEditSubject(editSubject + placeholder);
        return;
      }
      const start = el.selectionStart ?? editSubject.length;
      const end = el.selectionEnd ?? editSubject.length;
      const next = editSubject.slice(0, start) + placeholder + editSubject.slice(end);
      setEditSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + placeholder.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      // Délègue à l'éditeur de blocs (insertion dans le dernier champ focusé)
      const ok = blockEditorRef.current?.insertVariableAtCursor(placeholder);
      if (!ok) {
        // Si aucun bloc n'est focusé, on append en fin de corps comme fallback
        // (l'utilisateur verra le placeholder apparaître quelque part — il peut
        // le couper-coller à l'endroit voulu, ou cliquer dans un bloc avant)
        setEditBody(editBody + (editBody.endsWith("\n") ? "" : "\n") + placeholder);
      }
    }
  };

  // Variables détectées dans le texte courant (sujet + corps)
  const detectedSubject = useMemo(() => extractUsedVars(editSubject), [editSubject]);
  const detectedBody = useMemo(() => extractUsedVars(editBody), [editBody]);
  const allDetected = useMemo(() => {
    const map = new Map<string, { valid: boolean; in: Array<"subject" | "body"> }>();
    for (const d of detectedSubject) {
      const cur = map.get(d.key) || { valid: d.valid, in: [] };
      cur.in.push("subject");
      map.set(d.key, cur);
    }
    for (const d of detectedBody) {
      const cur = map.get(d.key) || { valid: d.valid, in: [] };
      if (!cur.in.includes("body")) cur.in.push("body");
      map.set(d.key, cur);
    }
    return Array.from(map.entries()).map(([key, info]) => ({
      key,
      valid: info.valid,
      inSubject: info.in.includes("subject"),
      inBody: info.in.includes("body"),
    }));
  }, [detectedSubject, detectedBody]);

  const dirty = editSubject !== template.subject || editBody !== template.body;
  const invalidVars = allDetected.filter((d) => !d.valid);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4 text-[#0A3855]" />
          Éditer le template : {template.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">

        {/* TOOLBAR D'INSERTION ─────────────────────────────────────────── */}
        <div className="bg-[#E5EDF1]/40 border border-[#0A3855]/10 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-[#0A3855]/70 font-semibold flex items-center gap-1.5">
              <Plus className="size-3" />
              Insérer une variable
            </p>
            <p className="text-[10px] text-gray-500 italic">
              Clique dans l&apos;objet ou le corps avant, puis sur un bouton — la variable se met au bon endroit.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_VARS.map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  title={`${v.description} — sera remplacé par : ${v.exampleHint}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-[#0A3855]/20 text-[#0A3855] hover:bg-[#0A3855] hover:text-white hover:border-[#0A3855] transition-colors"
                >
                  <Icon className="size-3" />
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* OBJET ──────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label>Objet de l&apos;email</Label>
          <Input
            ref={subjectRef}
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            onFocus={() => setActiveField("subject")}
            placeholder="Objet du mail…"
          />
        </div>

        {/* CORPS ──────────────────────────────────────────────────────── */}
        {/* Éditeur par blocs : Coline ne voit plus jamais de HTML. Elle */}
        {/* empile des blocs (titre, paragraphe, liste, bouton…) et tape  */}
        {/* du texte. Le HTML est généré au moment de la sauvegarde.      */}
        <div
          onFocus={() => setActiveField("body")}
          onClick={() => setActiveField("body")}
        >
          <BlockEditor
            ref={blockEditorRef}
            html={editBody}
            onChange={setEditBody}
          />
        </div>

        {/* VARIABLES DÉTECTÉES (surlignage live) ──────────────────────── */}
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              Variables détectées dans le mail
            </p>
            {allDetected.length === 0 && (
              <span className="text-[10px] text-gray-400 italic">Aucune variable utilisée</span>
            )}
          </div>
          {allDetected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allDetected.map((d) => {
                const def = AVAILABLE_VARS.find((v) => v.key === d.key);
                const exampleValue = previewVars[d.key];
                if (d.valid && def) {
                  const Icon = def.icon;
                  return (
                    <span
                      key={d.key}
                      title={`Sera remplacé par : ${exampleValue || def.exampleHint}${previewPartnerName ? ` (pour ${previewPartnerName})` : ""}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      <Icon className="size-2.5" />
                      {def.label}
                      <span className="text-emerald-400">·</span>
                      <span className="text-emerald-600 font-mono truncate max-w-[180px]">
                        {exampleValue || def.exampleHint}
                      </span>
                    </span>
                  );
                }
                // Invalide : typo
                return (
                  <span
                    key={d.key}
                    title={`Variable inconnue. Vérifie l'orthographe (sensible à la casse).`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    <AlertTriangle className="size-2.5" />
                    {`{{${d.key}}}`}
                    <span className="text-rose-400">·</span>
                    <span className="text-rose-500 italic">non reconnue</span>
                  </span>
                );
              })}
            </div>
          )}
          {invalidVars.length > 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-xs">
                {invalidVars.length} variable{invalidVars.length > 1 ? "s" : ""} non reconnue
                {invalidVars.length > 1 ? "s" : ""} — elle{invalidVars.length > 1 ? "s" : ""}
                {invalidVars.length > 1 ? " resteront" : " restera"} affichée
                {invalidVars.length > 1 ? "s" : ""} telles quelles dans le mail.
                Utilise les boutons « Insérer » au-dessus plutôt que de taper à la main.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* ACTIONS ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={onSave}
            disabled={saving || saved}
            className={saved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            {saving ? (
              <><Loader2 className="size-4 mr-1.5 animate-spin" /> Sauvegarde…</>
            ) : saved ? (
              <><Check className="size-4 mr-1.5" /> Sauvegardé</>
            ) : (
              <><Save className="size-4 mr-1.5" /> Sauvegarder</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onSaveWithName}
            disabled={saving}
            title="Sauvegarder en donnant un nom à cette version (utile pour retrouver facilement plus tard)"
          >
            <Camera className="size-4 mr-1.5" />
            Sauver avec un nom
          </Button>
          {dirty && (
            <span className="text-xs text-amber-600 font-medium">Modifications non sauvegardées</span>
          )}
        </div>

        {/* HISTORIQUE DES VERSIONS ────────────────────────────────────── */}
        <TemplateVersionsPanel
          templateId={template.id}
          currentSubject={editSubject}
          currentBody={editBody}
        />
      </CardContent>
    </Card>
  );
}
