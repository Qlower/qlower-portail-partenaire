"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2, Clover } from "lucide-react";

interface PastRating {
  id: string;
  rating: number;
  scope: string;
  comment: string | null;
  created_at: string;
}

const SCOPES = [
  { value: "global", label: "Globalement Qlower" },
  { value: "plateforme", label: "La plateforme partenaire" },
  { value: "support", label: "Le support / réactivité" },
  { value: "commission", label: "Le système de commissions" },
  { value: "process", label: "Le processus d'onboarding" },
];

const fmtDt = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

export default function AvisPage() {
  const [rating, setRating] = useState<number>(0);
  const [scope, setScope] = useState("global");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<PastRating[]>([]);
  const [hover, setHover] = useState<number>(0);

  useEffect(() => {
    fetch("/api/partner/rating")
      .then((r) => r.json())
      .then((j) => setPast(j.ratings || []))
      .catch(() => {});
  }, [success]);

  async function submit() {
    if (rating < 1) {
      setError("Sélectionne au moins 1 trèfle 🍀");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/partner/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, scope, comment }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSuccess(true);
      setRating(0);
      setComment("");
      setScope("global");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="w-3 h-3" /> Retour dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#0A3855] flex items-center gap-2">
          <Clover className="w-6 h-6 text-emerald-600" />
          Votre avis sur Qlower
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Notez votre expérience et aidez-nous à améliorer la plateforme.
        </p>
      </div>

      {/* Disclaimer interne explicite */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-900 space-y-1">
          <p className="font-semibold">🔒 Retour strictement interne</p>
          <p>
            Votre avis sert uniquement à <strong>améliorer notre produit, nos process et nos outils</strong>.
            Il ne sera <strong>jamais publié sans votre accord explicite</strong>.
          </p>
          <p>
            Si on souhaite reprendre un extrait de votre commentaire pour un témoignage public
            (site qlower.com, présentation, etc.), votre interlocutrice Coline vous contactera
            directement pour obtenir votre validation et signer une autorisation.
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-5">
        {success ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Merci pour votre avis 🍀</p>
              <p className="text-xs mt-1">Il est bien enregistré côté Qlower. Vous pouvez en laisser un nouveau quand vous voulez.</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-[#0A3855] block mb-2">
                Votre note globale
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`${n} trèfle${n > 1 ? "s" : ""}`}
                  >
                    <Clover
                      className={`w-9 h-9 ${(hover ? hover >= n : rating >= n) ? "fill-emerald-500 text-emerald-600" : "text-gray-300"}`}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
                <span className="ml-3 text-sm text-gray-500">
                  {rating === 0 ? "—" : `${rating}/5`}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">1 = très insatisfait · 5 = très satisfait</p>
            </div>

            <div>
              <label className="text-sm font-medium text-[#0A3855] block mb-2">
                Sur quoi porte votre avis ?
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#0A3855] block mb-2">
                Votre commentaire <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="Ce qui marche, ce qui pourrait être mieux, vos suggestions concrètes…"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855]"
              />
              <p className="text-[11px] text-gray-400 mt-1">{comment.length} / 4000 caractères</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || rating < 1}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-[#0A3855] text-white rounded-lg hover:bg-[#0d4f78] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clover className="w-4 h-4" />}
                Envoyer mon avis
              </button>
            </div>
          </>
        )}
      </div>

      {/* Historique des avis */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0A3855]">Vos avis précédents</h2>
          <div className="space-y-2">
            {past.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Clover
                        key={n}
                        className={`w-4 h-4 ${p.rating >= n ? "fill-emerald-500 text-emerald-600" : "text-gray-200"}`}
                        strokeWidth={1.5}
                      />
                    ))}
                    <span className="ml-2 text-xs text-gray-500">{p.rating}/5</span>
                  </div>
                  <span className="text-[11px] text-gray-400">{fmtDt(p.created_at)}</span>
                </div>
                <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">
                  {SCOPES.find((s) => s.value === p.scope)?.label || p.scope}
                </div>
                {p.comment && (
                  <p className="text-xs text-gray-700 italic leading-relaxed">&ldquo;{p.comment}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
