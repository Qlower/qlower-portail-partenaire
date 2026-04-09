"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

type Audience = "tous" | "affiliation" | "marque_blanche";

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export default function CampagnesTab() {
  const { data: partners = [], isLoading: loadingPartners } = useAdminPartners();
  const { data: templates = [], isLoading: loadingTemplates } = useEmailTemplates();
  const updateTemplate = useUpdateEmailTemplate();

  const [audience, setAudience] = useState<Audience>("tous");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [sentPartners, setSentPartners] = useState<Set<string>>(new Set());
  const [allSent, setAllSent] = useState(false);
  const [sending, setSending] = useState(false);

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
        link: `https://secure.qlower.com/signup?utm_source=${previewPartner.utm}&utm_medium=affiliation&utm_campaign=${previewPartner.code}`,
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

  const handleSendAll = async () => {
    if (!selectedTemplateId || selected.length === 0) return;
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
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const ids = new Set(selected.map((p) => p.id));
      setSentPartners(ids);
      setAllSent(true);
    } catch {
      alert("Erreur lors de l'envoi des emails. Vérifiez la configuration Resend.");
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
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#0A3855]" />
              Éditer le template : {template.title}
              <span className="text-xs font-normal text-gray-400 ml-2">
                Variables : {"{{nom}} {{code}} {{utm}} {{leads}} {{abonnes}} {{link}}"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Objet de l'email</Label>
              <Input
                value={editSubject}
                onChange={(e) => { setEditSubject(e.target.value); setSaved(false); }}
                placeholder="Objet du mail..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contenu HTML</Label>
              <textarea
                value={editBody}
                onChange={(e) => { setEditBody(e.target.value); setSaved(false); }}
                rows={12}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855]"
                placeholder="Contenu HTML du template..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveTemplate}
                disabled={updateTemplate.isPending || saved}
                className={saved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {updateTemplate.isPending ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" /> Sauvegarde...</>
                ) : saved ? (
                  <><Check className="size-4 mr-1.5" /> Sauvegardé</>
                ) : (
                  <><Save className="size-4 mr-1.5" /> Sauvegarder le template</>
                )}
              </Button>
              {editSubject !== template.subject || editBody !== template.body ? (
                <span className="text-xs text-amber-600 font-medium">Modifications non sauvegardées</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
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
                  onClick={handleSendAll}
                  disabled={selected.length === 0 || allSent || sending}
                >
                  {sending ? (
                    <><Loader2 className="size-4 mr-1.5 animate-spin" /> Envoi en cours...</>
                  ) : allSent ? (
                    <><CheckCircle2 className="size-4 mr-1.5" /> Envoyé à {selected.length} partenaire(s)</>
                  ) : (
                    <><Send className="size-4 mr-1.5" /> Envoyer à {selected.length} partenaire(s)</>
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
    </div>
  );
}
