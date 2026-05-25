"use client";

// Panneau "Versions sauvegardées" — dropdown + modal de restauration.
// Coline peut consulter l'historique des sauvegardes d'un template et restaurer
// une version précédente (l'état actuel est archivé en filet de sécurité).

import { useState } from "react";
import {
  useEmailTemplateVersions,
  useRestoreEmailTemplateVersion,
  useStarEmailTemplateVersion,
  type EmailTemplateVersion,
} from "@/hooks/useAdminData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  History,
  Star,
  StarOff,
  RotateCcw,
  Loader2,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  templateId: string;
  currentSubject: string;
  currentBody: string;
}

// Formate une date relative ("il y a 2h", "hier", ou date pleine au-delà de 7j)
function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Compte les mots (utilisé pour le résumé de diff)
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export default function TemplateVersionsPanel({
  templateId,
  currentSubject,
  currentBody,
}: Props) {
  const { data: versions = [], isLoading } = useEmailTemplateVersions(templateId);
  const restore = useRestoreEmailTemplateVersion();
  const star = useStarEmailTemplateVersion();

  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<EmailTemplateVersion | null>(null);
  const [labelEditId, setLabelEditId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");

  const handleRestore = async () => {
    if (!selected) return;
    if (
      !confirm(
        `Restaurer la version "${selected.label || fmtRelative(selected.saved_at)}" ?\n\n` +
          "Le contenu actuel sera archivé comme version automatique avant restauration — rien n'est perdu.",
      )
    ) {
      return;
    }
    try {
      await restore.mutateAsync({ templateId, versionId: selected.id });
      setSelected(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors de la restauration");
    }
  };

  const handleStar = async (version: EmailTemplateVersion, newLabel: string | null) => {
    try {
      await star.mutateAsync({ templateId, versionId: version.id, label: newLabel });
      setLabelEditId(null);
      setLabelInput("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors du nommage");
    }
  };

  // Tri : étoilées en premier, puis les autres par date desc
  const sorted = [...versions].sort((a, b) => {
    if (!!a.label !== !!b.label) return a.label ? -1 : 1;
    return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
  });

  if (isLoading) {
    return (
      <div className="text-xs text-gray-400 flex items-center gap-2">
        <Loader2 className="size-3 animate-spin" /> Chargement des versions…
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      {/* En-tête cliquable pour replier/déplier */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="size-4 text-[#0A3855]" />
          <span className="text-sm font-semibold text-[#0A3855]">
            Versions sauvegardées
          </span>
          <span className="text-xs text-gray-400">
            ({versions.length})
          </span>
        </div>
        {expanded ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {versions.length === 0 ? (
            <p className="text-xs text-gray-400 italic p-3">
              Aucune version sauvegardée. Chaque modification créera une version automatiquement.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {sorted.map((v) => {
                const isLabelEditing = labelEditId === v.id;
                const isStarred = !!v.label;
                return (
                  <li key={v.id} className="px-3 py-2 hover:bg-[#E5EDF1]/15 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Label ou date */}
                        {isLabelEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={labelInput}
                              onChange={(e) => setLabelInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleStar(v, labelInput || null);
                                if (e.key === "Escape") {
                                  setLabelEditId(null);
                                  setLabelInput("");
                                }
                              }}
                              placeholder="Nom de la version…"
                              className="text-xs h-7"
                            />
                            <button
                              onClick={() => handleStar(v, labelInput || null)}
                              className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
                              title="Valider"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setLabelEditId(null);
                                setLabelInput("");
                              }}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400"
                              title="Annuler"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {isStarred ? (
                              <Star className="size-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                            ) : (
                              <span className="size-3 flex-shrink-0" />
                            )}
                            <span
                              className={`text-xs ${isStarred ? "font-semibold text-[#0A3855]" : "text-gray-700"} truncate`}
                              title={v.label || "Sauvegarde automatique"}
                            >
                              {v.label || "Sauvegarde automatique"}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5 ml-4">
                          {fmtRelative(v.saved_at)}
                          {v.saved_by_email && (
                            <span> · par {v.saved_by_email}</span>
                          )}
                        </div>
                      </div>

                      {!isLabelEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setLabelEditId(v.id);
                              setLabelInput(v.label || "");
                            }}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-500"
                            title={isStarred ? "Renommer / déStar" : "Nommer / étoiler cette version"}
                          >
                            {isStarred ? <StarOff className="size-3.5" /> : <Star className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelected(v)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0A3855]"
                            title="Prévisualiser et restaurer"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Modal de preview + restore */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <h2 className="text-base font-semibold text-[#0A3855] flex items-center gap-2">
                  {selected.label ? (
                    <>
                      <Star className="size-4 text-amber-500 fill-amber-500" />
                      {selected.label}
                    </>
                  ) : (
                    <>
                      <History className="size-4 text-gray-400" />
                      Sauvegarde automatique
                    </>
                  )}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmtRelative(selected.saved_at)}
                  {selected.saved_by_email && ` · par ${selected.saved_by_email}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {/* Résumé du diff */}
              {(() => {
                const subjDiff = wordCount(selected.subject) - wordCount(currentSubject);
                const bodyDiff = wordCount(selected.body) - wordCount(currentBody);
                const subjChanged = selected.subject !== currentSubject;
                const bodyChanged = selected.body !== currentBody;
                if (!subjChanged && !bodyChanged) {
                  return (
                    <Alert>
                      <AlertCircle className="size-4 text-gray-400" />
                      <AlertDescription className="text-xs">
                        Cette version est <strong>identique</strong> au contenu actuel. Aucune restauration nécessaire.
                      </AlertDescription>
                    </Alert>
                  );
                }
                return (
                  <Alert>
                    <AlertCircle className="size-4 text-[#0A3855]" />
                    <AlertDescription className="text-xs">
                      <strong>Différences par rapport à la version actuelle :</strong>
                      <ul className="mt-1 ml-3 list-disc">
                        {subjChanged && (
                          <li>
                            Objet : {subjDiff > 0 ? `+${subjDiff}` : subjDiff} mots
                          </li>
                        )}
                        {bodyChanged && (
                          <li>
                            Corps : {bodyDiff > 0 ? `+${bodyDiff}` : bodyDiff} mots
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Comparaison côte à côte */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold mb-1">
                    Version actuelle (à archiver si restauration)
                  </p>
                  <div className="border border-rose-100 rounded-lg bg-rose-50/30 p-3">
                    <p className="text-xs font-semibold text-gray-900 mb-2">{currentSubject}</p>
                    <div
                      className="text-xs text-gray-700 max-h-96 overflow-y-auto prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentBody }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-1">
                    Cette version (à restaurer)
                  </p>
                  <div className="border border-emerald-100 rounded-lg bg-emerald-50/30 p-3">
                    <p className="text-xs font-semibold text-gray-900 mb-2">{selected.subject}</p>
                    <div
                      className="text-xs text-gray-700 max-h-96 overflow-y-auto prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selected.body }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleRestore}
                  disabled={restore.isPending || selected.subject === currentSubject && selected.body === currentBody}
                  className="bg-[#0A3855] hover:bg-[#0A3855]/90"
                >
                  {restore.isPending ? (
                    <><Loader2 className="size-4 mr-1.5 animate-spin" /> Restauration…</>
                  ) : (
                    <><RotateCcw className="size-4 mr-1.5" /> Restaurer cette version</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
