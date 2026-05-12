"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clover,
  Loader2,
  Star,
  Check,
  X,
  Copy as CopyIcon,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

interface AdminRating {
  id: string;
  partner_id: string;
  author_email: string | null;
  rating: number;
  scope: string;
  comment: string | null;
  created_at: string;
  curated: boolean;
  curated_quote: string | null;
  curator_note: string | null;
  curated_by: string | null;
  curated_at: string | null;
  used_in: string[];
  partner: { id: string; nom: string; contrat: string; utm: string } | null;
}

const fmtDt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

const SCOPE_LABELS: Record<string, string> = {
  global: "Globalement",
  plateforme: "Plateforme",
  support: "Support",
  commission: "Commissions",
  process: "Onboarding",
};

const USE_CONTEXTS = [
  { value: "site", label: "Site qlower.com" },
  { value: "mb_deck", label: "Slide MB" },
  { value: "invest_deck", label: "Deck invest" },
  { value: "interne", label: "Doc interne" },
];

export default function AdminAvisPage() {
  const [ratings, setRatings] = useState<AdminRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "curated" | "uncurated" | "top">("all");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === "curated") params.set("curated", "true");
      if (filter === "uncurated") params.set("curated", "false");
      if (filter === "top") params.set("min_rating", "4");
      const r = await fetch(`/api/admin/ratings?${params}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setRatings(j.ratings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function updateRating(id: string, updates: Partial<AdminRating>) {
    try {
      const r = await fetch("/api/admin/ratings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  }

  // Stats
  const total = ratings.length;
  const avg = total > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / total : 0;
  const curatedCount = ratings.filter((r) => r.curated).length;
  const topCount = ratings.filter((r) => r.rating >= 4).length;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="w-3 h-3" /> Retour admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#0A3855] flex items-center gap-2">
          <Clover className="w-6 h-6 text-emerald-600" />
          Avis partenaires — Note Trèfle (NTS)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Système de notation interne. Sélectionne les meilleurs avis pour les decks externes (site, MB, invest).
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total avis" value={total} />
        <StatCard label="Note moyenne" value={avg.toFixed(2)} suffix="/5" highlight />
        <StatCard label="≥ 4 trèfles" value={topCount} sub={total > 0 ? `${Math.round((topCount / total) * 100)}%` : ""} />
        <StatCard label="Curés" value={curatedCount} sub="pour usage externe" />
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Les partenaires voient explicitement que <strong>leur avis est interne</strong> par défaut.
          Avant de publier un témoignage externe avec leur citation, <strong>fais valider Coline auprès du partenaire</strong>.
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { v: "all", l: "Tous" },
          { v: "uncurated", l: "À examiner" },
          { v: "curated", l: "Curés" },
          { v: "top", l: "≥ 4 trèfles" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as typeof filter)}
            className={`text-xs px-3 py-1.5 rounded border ${filter === f.v ? "bg-[#0A3855] text-white border-[#0A3855]" : "bg-white border-gray-200 text-gray-700"}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : ratings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          Aucun avis dans ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) => (
            <RatingCard key={r.id} r={r} onUpdate={updateRating} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, suffix, highlight }: { label: string; value: string | number; sub?: string; suffix?: string; highlight?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? "text-emerald-600" : "text-[#0A3855]"}`}>
        {value}{suffix ? <span className="text-base font-normal text-gray-400">{suffix}</span> : null}
      </div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function RatingCard({
  r,
  onUpdate,
}: {
  r: AdminRating;
  onUpdate: (id: string, updates: Partial<AdminRating>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(r.curated_quote || r.comment || "");
  const [note, setNote] = useState(r.curator_note || "");
  const [usedIn, setUsedIn] = useState<string[]>(r.used_in || []);
  const [saving, setSaving] = useState(false);

  function toggleUsedIn(v: string) {
    setUsedIn((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function save(curated: boolean) {
    setSaving(true);
    try {
      await onUpdate(r.id, { curated, curated_quote: quote, curator_note: note, used_in: usedIn });
      if (!curated) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function copyQuote() {
    const txt = quote || r.comment || "";
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(`"${txt}" — ${r.partner?.nom || "Partenaire Qlower"}`);
    } catch {}
  }

  return (
    <div className={`bg-white border rounded-lg p-4 ${r.curated ? "border-emerald-200 ring-1 ring-emerald-100" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#0A3855]">{r.partner?.nom || "—"}</span>
            <span className="text-[11px] text-gray-500">({r.partner?.contrat || "?"})</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {SCOPE_LABELS[r.scope] || r.scope}
            </span>
            {r.curated && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                ✓ Curé
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {r.author_email || "—"} · {fmtDt(r.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {[1, 2, 3, 4, 5].map((n) => (
            <Clover key={n} className={`w-4 h-4 ${r.rating >= n ? "fill-emerald-500 text-emerald-600" : "text-gray-200"}`} strokeWidth={1.5} />
          ))}
          <span className="ml-1 text-xs font-semibold text-emerald-700">{r.rating}</span>
        </div>
      </div>

      {r.comment ? (
        <blockquote className="text-sm text-gray-700 italic leading-relaxed border-l-2 border-gray-200 pl-3">
          &ldquo;{r.comment}&rdquo;
        </blockquote>
      ) : (
        <p className="text-xs text-gray-400 italic">(pas de commentaire)</p>
      )}

      {r.curated && r.used_in.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.used_in.map((u) => (
            <span key={u} className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
              📌 {USE_CONTEXTS.find((c) => c.value === u)?.label || u}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {!open ? (
          <>
            <button
              onClick={() => setOpen(true)}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
            >
              {r.curated ? "Modifier" : "Curer pour usage externe"}
            </button>
            {(r.curated || r.comment) && (
              <button
                onClick={copyQuote}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
                title="Copier la citation prête à coller"
              >
                <CopyIcon className="w-3 h-3" /> Copier
              </button>
            )}
            {r.curated && (
              <button
                onClick={() => onUpdate(r.id, { curated: false })}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
              >
                Retirer de la curation
              </button>
            )}
          </>
        ) : (
          <div className="w-full space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">
                Citation nettoyée pour les decks
              </label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded bg-white"
                placeholder="Version finale du quote (faute corrigée, raccourci, etc.)"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">
                Note interne (pourquoi cet avis ?)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: testimonial fort sur l'onboarding"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">
                Contextes d&apos;usage prévus
              </label>
              <div className="flex flex-wrap gap-2">
                {USE_CONTEXTS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => toggleUsedIn(c.value)}
                    className={`text-xs px-3 py-1.5 rounded border ${usedIn.includes(c.value) ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
                  >
                    {usedIn.includes(c.value) ? "✓ " : ""}{c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Sauvegarder comme curé
              </button>
              <button
                onClick={() => { setOpen(false); setQuote(r.curated_quote || r.comment || ""); setNote(r.curator_note || ""); setUsedIn(r.used_in || []); }}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {r.curator_note && !open && (
        <div className="mt-3 text-[11px] text-gray-500 italic">
          📝 {r.curator_note}
        </div>
      )}
    </div>
  );
}
