"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface DuplicateGroup {
  id: string;
  match_signal: "phone_last9" | "name_normalized";
  match_value: string;
  contact_ids: string[];
  contact_emails: (string | null)[];
  contact_names: string[];
  contact_owners: (string | null)[];
  score: number;
  detected_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
}

const fmtDt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

export default function DoublonsPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [lastScan, setLastScan] = useState<{
    scanned: number;
    pages: number;
    groups_found: number;
    groups_inserted: number;
    duration_ms: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(resolved: boolean) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/detect-duplicates?resolved=${resolved}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setGroups(j.groups || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(showResolved);
  }, [showResolved]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/detect-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxContacts: 1500, windowDays: 365 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setLastScan(j);
      await load(showResolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setScanning(false);
    }
  }

  async function markResolved(id: string, resolved: boolean, note?: string) {
    try {
      const r = await fetch("/api/admin/detect-duplicates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await load(showResolved);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="w-3 h-3" /> Retour admin
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3855]">Doublons HubSpot</h1>
          <p className="text-sm text-gray-500 mt-1">
            Détection proactive de fiches HubSpot probablement doublonnées (même téléphone ou même nom).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(false)}
            className={`text-xs px-3 py-1.5 rounded border ${!showResolved ? "bg-[#0A3855] text-white border-[#0A3855]" : "bg-white border-gray-200 text-gray-700"}`}
          >
            À traiter
          </button>
          <button
            onClick={() => setShowResolved(true)}
            className={`text-xs px-3 py-1.5 rounded border ${showResolved ? "bg-[#0A3855] text-white border-[#0A3855]" : "bg-white border-gray-200 text-gray-700"}`}
          >
            Résolus
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#F6CCA4] text-[#6B4D2D] hover:bg-[#F0BF8E] border border-[#E8B88A] rounded font-medium disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Scanner HubSpot maintenant
          </button>
        </div>
      </div>

      {/* Scan report */}
      {lastScan && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
          ✅ Scan terminé : {lastScan.scanned} contacts analysés ({lastScan.pages} pages HubSpot) en {(lastScan.duration_ms / 1000).toFixed(1)}s ·{" "}
          <strong>{lastScan.groups_found} groupe{lastScan.groups_found > 1 ? "s" : ""} de doublons</strong>{" "}
          ({lastScan.groups_inserted} nouveau{lastScan.groups_inserted > 1 ? "x" : ""})
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </div>
      )}

      {/* Empty state */}
      {!loading && groups.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          {showResolved ? "Aucun doublon résolu." : "Aucun doublon en attente."}{" "}
          {!showResolved && "Lance un scan pour détecter les fiches HubSpot probablement dupliquées."}
        </div>
      )}

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((g) => (
          <DuplicateCard key={g.id} group={g} onMarkResolved={markResolved} />
        ))}
      </div>

      <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-4">
        💡 La détection est <strong>manuelle</strong> (limite Vercel Hobby = 2 crons utilisés ailleurs).
        Lance le scan une fois par semaine pour rester à jour. Score 90 = phone match (très probable), 55 = name only.
      </div>
    </div>
  );
}

function DuplicateCard({
  group,
  onMarkResolved,
}: {
  group: DuplicateGroup;
  onMarkResolved: (id: string, resolved: boolean, note?: string) => Promise<void>;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const signalBadge =
    group.match_signal === "phone_last9"
      ? { bg: "bg-red-100", text: "text-red-700", label: `📞 Tél · ${group.match_value}` }
      : { bg: "bg-amber-100", text: "text-amber-700", label: `👤 Nom · ${group.match_value}` };

  return (
    <div className={`bg-white border rounded-lg p-4 ${group.resolved ? "border-gray-200 opacity-60" : "border-orange-200"}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${signalBadge.bg} ${signalBadge.text}`}>
            {signalBadge.label}
          </span>
          <span className="text-[11px] text-gray-500">
            Score {group.score}/100
          </span>
          {group.resolved && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Résolu {group.resolved_at ? `le ${fmtDt(group.resolved_at)}` : ""}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400">Détecté {fmtDt(group.detected_at)}</div>
      </div>

      <div className="space-y-1.5 mb-3">
        {group.contact_ids.map((cid, i) => (
          <a
            key={cid}
            href={`https://app-eu1.hubspot.com/contacts/qlower/contact/${cid}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs hover:bg-gray-100"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate">
                {group.contact_names[i] || "—"}
              </div>
              <div className="font-mono text-[11px] text-gray-500 truncate">
                {group.contact_emails[i] || "(pas d'email)"}
              </div>
            </div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">
              Owner #{group.contact_owners[i] || "—"}
            </div>
            <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
          </a>
        ))}
      </div>

      {group.resolution_note && (
        <div className="bg-gray-50 border border-gray-100 rounded p-2 text-[11px] text-gray-600 mb-3">
          <strong>Note :</strong> {group.resolution_note}
        </div>
      )}

      {!group.resolved && (
        <div className="flex items-center gap-2">
          {!noteOpen ? (
            <>
              <a
                href="https://app-eu1.hubspot.com/contacts/qlower/objects/0-1/views/all"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-[#0A3855] text-white rounded hover:bg-[#0d4f78]"
              >
                Ouvrir HubSpot pour fusionner
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setNoteOpen(true)}
                className="text-[11px] px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
              >
                Marquer comme résolu
              </button>
              <button
                onClick={() => onMarkResolved(group.id, true, "Faux positif")}
                className="text-[11px] px-3 py-1.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
              >
                Faux positif
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (ex: fusionné dans HubSpot)"
                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded"
              />
              <button
                onClick={() => {
                  onMarkResolved(group.id, true, note);
                  setNoteOpen(false);
                  setNote("");
                }}
                className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                <Check className="w-3 h-3" /> Confirmer
              </button>
              <button
                onClick={() => {
                  setNoteOpen(false);
                  setNote("");
                }}
                className="text-[11px] px-3 py-1.5 border border-gray-200 rounded text-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {group.resolved && (
        <button
          onClick={() => onMarkResolved(group.id, false)}
          className="text-[11px] text-gray-500 hover:text-[#0A3855] underline"
        >
          Rouvrir
        </button>
      )}
    </div>
  );
}
