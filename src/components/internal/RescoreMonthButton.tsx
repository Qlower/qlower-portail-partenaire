"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  yearMonth: string;
  isLocked: boolean;
}

interface BatchResponse {
  ok: true;
  total: number;
  batch_size: number;
  rescored: number;
  changed: number;
  errors_count: number;
  errors: string[];
  offset: number;
  next_offset: number | null;
}

const BATCH_SIZE = 20;

/**
 * Bouton "Rescore mois" — sales_admin only.
 *
 * Re-score toutes les lignes non-override d'un mois. Comme la Vercel
 * function coupe à 60s, on traite par chunks de 20 lignes côté serveur
 * et le client boucle jusqu'à la fin. Barre de progression incluse.
 */
export default function RescoreMonthButton({ yearMonth, isLocked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    rescored: number;
    changed: number;
    errors: number;
  }>({ processed: 0, total: 0, rescored: 0, changed: 0, errors: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callBatch(offset: number, force: boolean): Promise<BatchResponse> {
    const r = await fetch(`/api/sales/rescore-month/${encodeURIComponent(yearMonth)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset, limit: BATCH_SIZE, force }),
    });
    const text = await r.text();
    let j: BatchResponse | { error: string };
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`Réponse non-JSON du serveur (HTTP ${r.status}). ${text.slice(0, 100)}`);
    }
    if (!r.ok || !("ok" in j)) {
      throw new Error(("error" in j ? j.error : `HTTP ${r.status}`));
    }
    return j;
  }

  async function run(force: boolean) {
    setLoading(true);
    setError(null);
    setDone(false);
    setProgress({ processed: 0, total: 0, rescored: 0, changed: 0, errors: 0 });

    let offset = 0;
    let rescored = 0;
    let changed = 0;
    let errs = 0;
    let total = 0;

    try {
      while (true) {
        const batch = await callBatch(offset, force);
        total = batch.total;
        rescored += batch.rescored;
        changed += batch.changed;
        errs += batch.errors_count;
        const newProcessed = batch.offset + batch.batch_size;
        setProgress({ processed: newProcessed, total, rescored, changed, errors: errs });

        if (batch.next_offset === null) break;
        offset = batch.next_offset;
        // Pause de courtoisie HubSpot rate-limit (100 req/10s)
        await new Promise((r) => setTimeout(r, 300));
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        title="Re-scorer toutes les lignes non-override de ce mois"
      >
        <RefreshCw className="w-3 h-3" />
        Rescore mois
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#0A3855]">
                Rescore du mois {yearMonth}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Recalcule l&apos;attribution auto avec la dernière logique scoring,
                pour toutes les lignes <strong>non overridées</strong>.
              </p>
            </div>

            <div className="p-5 space-y-3">
              {isLocked && !loading && !done && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>Ce mois est verrouillé. Force le rescore si tu sais ce que tu fais.</div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <strong>Erreur :</strong> {error}
                  <div className="mt-1 text-red-600">
                    {progress.processed > 0 && (
                      <>Note : {progress.processed} ligne{progress.processed > 1 ? "s" : ""} ont déjà été traitées avant l&apos;erreur.</>
                    )}
                  </div>
                </div>
              )}

              {(loading || done) && progress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {progress.processed} / {progress.total} ligne{progress.total > 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-[#0A3855]">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${done ? "bg-emerald-500" : "bg-[#0A3855]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-3">
                    <span>{progress.rescored} re-scorées</span>
                    <span>·</span>
                    <span className="text-[#0A3855] font-semibold">{progress.changed} attribution{progress.changed > 1 ? "s ont" : " a"} changé</span>
                    {progress.errors > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-orange-700">{progress.errors} erreur{progress.errors > 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {done && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    Rescore terminé. <strong>{progress.changed}</strong> attribution{progress.changed > 1 ? "s ont" : " a"} été mise{progress.changed > 1 ? "s" : ""} à jour avec la nouvelle logique.
                  </div>
                </div>
              )}

              <div className="text-[11px] text-gray-500 leading-relaxed">
                Traitement par batches de {BATCH_SIZE} lignes (Vercel timeout 60s).
                Les overrides ne sont pas touchés. Compter ~1 min pour 100 lignes.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
              <button
                onClick={() => { setOpen(false); setDone(false); setError(null); setProgress({ processed: 0, total: 0, rescored: 0, changed: 0, errors: 0 }); }}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700"
                disabled={loading}
              >
                {done ? "Fermer" : "Annuler"}
              </button>
              {!done && (
                <button
                  onClick={() => run(isLocked)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0A3855] text-white rounded hover:bg-[#0d4f78] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {loading ? "Rescore en cours…" : isLocked ? "Forcer le rescore" : "Lancer le rescore"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
