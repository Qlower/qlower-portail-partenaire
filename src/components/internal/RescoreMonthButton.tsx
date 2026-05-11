"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  yearMonth: string;
  isLocked: boolean;
}

/**
 * Bouton "Rescore mois" — sales_admin only.
 *
 * Permet de re-scorer toutes les lignes non-override d'un mois donné avec
 * la version courante de l'algo (utile après une mise à jour de la logique
 * scoring, ou pour rattraper les vieux mois que le cron horaire ne couvre
 * pas — il ne traite que les 7 derniers jours).
 */
export default function RescoreMonthButton({ yearMonth, isLocked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    total: number;
    rescored: number;
    changed: number;
    errors_count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(force = false) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const r = await fetch(`/api/sales/rescore-month/${encodeURIComponent(yearMonth)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setReport(j);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        title="Re-scorer toutes les lignes non-override de ce mois avec la dernière version de l'algo"
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
                pour toutes les lignes <strong>non overridées</strong> du mois.
              </p>
            </div>

            <div className="p-5 space-y-3">
              {isLocked && !report && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>Ce mois est verrouillé. Le rescore est bloqué par défaut — utilise &quot;forcer&quot; si tu sais ce que tu fais.</div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {error}
                </div>
              )}

              {report && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
                  <div>✅ Rescore terminé pour <strong>{yearMonth}</strong></div>
                  <div>{report.rescored} ligne{report.rescored > 1 ? "s" : ""} re-scorée{report.rescored > 1 ? "s" : ""} sur {report.total}</div>
                  <div><strong>{report.changed}</strong> attribution{report.changed > 1 ? "s ont" : " a"} changé</div>
                  {report.errors_count > 0 && (
                    <div className="text-orange-700">⚠️ {report.errors_count} erreur(s) HubSpot — voir logs Vercel</div>
                  )}
                </div>
              )}

              <div className="text-[11px] text-gray-500 leading-relaxed">
                Les lignes override (modifications manuelles) ne sont pas touchées.
                Le rescore appelle HubSpot pour chaque ligne — peut prendre 30-60s
                pour un mois complet (300 lignes).
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
              <button
                onClick={() => { setOpen(false); setReport(null); setError(null); }}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700"
                disabled={loading}
              >
                Fermer
              </button>
              {!report && (
                <button
                  onClick={() => run(isLocked)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0A3855] text-white rounded hover:bg-[#0d4f78] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {isLocked ? "Forcer le rescore" : "Lancer le rescore"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
