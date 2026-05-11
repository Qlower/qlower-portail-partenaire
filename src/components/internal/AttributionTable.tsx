"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, MessageSquare, Flag, Plus, Search } from "lucide-react";
import EngagementPanel from "./EngagementPanel";

export interface CommercialOption {
  id: string;
  name: string;
  role: string;
}

export interface HistoryEntry {
  id: string;
  when_at: string;
  who_email: string | null;
  from_commercial: string | null;
  to_commercial: string | null;
  comment: string | null;
}

export interface NoteEntry {
  id: string;
  author_email: string | null;
  when_at: string;
  text: string;
}

export interface RowData {
  charge_id: string;
  email: string;
  client_name: string | null;
  created_at: string;
  amount_net_eur: number;
  family: string | null;
  newbiz_1m: string | null;
  newbiz_3m: string | null;
  auto_commercial_id: string | null;
  auto_score: number | null;
  auto_source: string | null;
  auto_reason: string | null;
  override_commercial_id: string | null;
  override_set_by_email: string | null;
  override_set_at: string | null;
  effective_commercial_id: string | null;
  effective_commercial_name: string | null;
  is_override: boolean;
  flagged_for_review: boolean;
  flagged_reason: string | null;
  history: HistoryEntry[];
  notes: NoteEntry[];
}

/**
 * Display mode of the attribution table.
 *
 * - admin: full edit (dropdown to change attribution + add notes + flag)
 * - sales-own: legacy single-user view (kept for backward compat)
 * - sales-team: tour de contrôle — tout le négo voit toutes les ventes,
 *              peut commenter n'importe laquelle, peut flag les siennes
 *              pour contester
 * - readonly: pure display (no dropdowns, no edit, no flag, no note add)
 */
export type AttributionTableMode = "admin" | "sales-own" | "sales-team" | "readonly";

interface Props {
  rows: RowData[];
  commercials: CommercialOption[];
  // Legacy boolean for backward compat: editable=true → "admin", false → "readonly"
  editable?: boolean;
  mode?: AttributionTableMode;
  yearMonth: string;
  /** When mode === "sales-own", show a flag button on each row */
  showFlagButton?: boolean;
  /** Commercial id of the current user — used to highlight own rows + restrict flag */
  myCommercialId?: string | null;
  /** If true, the "Mes ventes" filter is preselected on mount */
  defaultFilterMine?: boolean;
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtDate = (iso: string) => iso.slice(0, 10);
const fmtDt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

function ScoreBadge({ score, isOverride }: { score: number | null; isOverride: boolean }) {
  if (isOverride) return <span className="inline-block min-w-[24px] px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-violet-600 text-center" title="Manuel">M</span>;
  const s = score ?? 0;
  let bg = "bg-gray-400";
  if (s >= 8) bg = "bg-emerald-600";
  else if (s >= 6) bg = "bg-amber-500";
  else if (s > 0) bg = "bg-red-500";
  return <span className={`inline-block min-w-[24px] px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${bg} text-center`}>{s}</span>;
}

export default function AttributionTable({
  rows: initialRows,
  commercials,
  editable,
  mode: modeProp,
  yearMonth,
  showFlagButton,
  myCommercialId,
  defaultFilterMine,
}: Props) {
  // Resolve effective mode (mode prop wins; else fall back to legacy editable bool)
  const mode: AttributionTableMode =
    modeProp ?? (editable ? "admin" : "readonly");
  const canEditAttribution = mode === "admin";
  // Tout négo / admin peut commenter (vue d'équipe partagée).
  const canAddNote = mode === "admin" || mode === "sales-own" || mode === "sales-team";
  // Flag de contestation : admin sur tout, sales-own/sales-team uniquement
  // sur les lignes qui me concernent (= attribution actuelle = moi).
  const canFlag = mode === "admin" || mode === "sales-own" || mode === "sales-team";
  const [rows, setRows] = useState(initialRows);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [noteFormChargeId, setNoteFormChargeId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "flagged" | "manual" | "low_score" | "search">(
    defaultFilterMine ? "mine" : "all",
  );
  // Filtre additionnel par commercial (compatible avec filterMode).
  // null = pas de filtre, "__unassigned__" = lignes Non attribué, sinon = id du commercial.
  const [filterCommercialId, setFilterCommercialId] = useState<string | null>(null);
  // Charge dont on affiche le panel HubSpot timeline (null = panel fermé)
  const [panelChargeId, setPanelChargeId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2400);
  };

  // Filtering — la recherche match email OU client_name OU partie locale de l'email
  // (ex: "baptiste" matche aussi baptiste.perlin@gmail.com même sans client_name).
  const filteredRows = rows.filter((r) => {
    if (filterMode === "mine" && r.effective_commercial_id !== myCommercialId) return false;
    if (filterMode === "flagged" && !r.flagged_for_review) return false;
    if (filterMode === "manual" && !r.is_override) return false;
    if (filterMode === "low_score" && (r.is_override || (r.auto_score ?? 0) >= 6)) return false;
    if (filterMode === "search" && filter) {
      const q = filter.toLowerCase();
      const haystack = [
        r.email.toLowerCase(),
        (r.client_name || "").toLowerCase(),
        r.email.split("@")[0].toLowerCase().replace(/[._-]/g, " "),
      ].join(" ");
      if (!haystack.includes(q)) return false;
    }
    // Filtre commercial — appliqué en plus des filtres ci-dessus
    if (filterCommercialId) {
      if (filterCommercialId === "__unassigned__") {
        if (r.effective_commercial_id) return false;
      } else if (r.effective_commercial_id !== filterCommercialId) {
        return false;
      }
    }
    return true;
  });

  // Compte par commercial — utile pour le badge dans le dropdown
  const countByCommercial = new Map<string, number>();
  let unassignedCount = 0;
  for (const r of rows) {
    if (!r.effective_commercial_id) {
      unassignedCount++;
    } else {
      countByCommercial.set(r.effective_commercial_id, (countByCommercial.get(r.effective_commercial_id) || 0) + 1);
    }
  }

  const myRowsCount = myCommercialId
    ? rows.filter((r) => r.effective_commercial_id === myCommercialId).length
    : 0;

  // Sort by net DESC
  filteredRows.sort((a, b) => b.amount_net_eur - a.amount_net_eur);

  async function changeAttribution(chargeId: string, newCommercialId: string | null) {
    const row = rows.find((r) => r.charge_id === chargeId);
    if (!row) {
      console.warn("[attribution] row not found", chargeId);
      return;
    }
    console.log("[attribution] changing", chargeId, "→", newCommercialId);
    try {
      const r = await fetch(`/api/sales/overrides/${encodeURIComponent(chargeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercial_id: newCommercialId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error("[attribution] API error", r.status, err);
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      const newCommercial = newCommercialId ? commercials.find((c) => c.id === newCommercialId) : null;
      const newCommercialName = newCommercialId
        ? newCommercial?.name || "—"
        : commercials.find((c) => c.id === row.auto_commercial_id)?.name || "Non attribué";

      setRows((prev) =>
        prev.map((r) =>
          r.charge_id === chargeId
            ? {
                ...r,
                override_commercial_id: newCommercialId,
                effective_commercial_id: newCommercialId || r.auto_commercial_id,
                effective_commercial_name: newCommercialName,
                is_override: !!newCommercialId,
                flagged_for_review: false,
                history: [
                  {
                    id: data.history_entry?.when || String(Date.now()),
                    when_at: data.history_entry?.when || new Date().toISOString(),
                    who_email: data.history_entry?.who || null,
                    from_commercial: data.history_entry?.from || null,
                    to_commercial: data.history_entry?.to || null,
                    comment: null,
                  },
                  ...r.history,
                ],
              }
            : r,
        ),
      );
      showToast(`Attribution → ${newCommercialName}`);
      // Refresh server data so totals stay accurate
      startTransition(() => router.refresh());
    } catch (e) {
      console.error("[attribution] changeAttribution failed", e);
      showToast(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`, true);
    }
  }

  async function addNote(chargeId: string) {
    if (!noteText.trim()) return;
    try {
      const r = await fetch(`/api/sales/notes/${encodeURIComponent(chargeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setRows((prev) =>
        prev.map((r) =>
          r.charge_id === chargeId
            ? { ...r, notes: [data.note, ...r.notes] }
            : r,
        ),
      );
      setNoteText("");
      setNoteFormChargeId(null);
      setOpenNotesId(chargeId);
      showToast("Note ajoutée");
    } catch (e) {
      showToast(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`, true);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Filtre :</span>
        {([
          { v: "all", l: `Toutes (${rows.length})`, hidden: false },
          { v: "mine", l: `👤 Mes ventes (${myRowsCount})`, hidden: !myCommercialId },
          { v: "flagged", l: `🚩 Contestées (${rows.filter((r) => r.flagged_for_review).length})`, hidden: false },
          { v: "manual", l: `✎ Manuelles (${rows.filter((r) => r.is_override).length})`, hidden: false },
          { v: "low_score", l: `À vérifier (${rows.filter((r) => !r.is_override && (r.auto_score ?? 0) > 0 && (r.auto_score ?? 0) < 6).length})`, hidden: false },
        ] as const).filter((opt) => !opt.hidden).map((opt) => (
          <button
            key={opt.v}
            onClick={() => { setFilterMode(opt.v); setFilter(""); }}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              filterMode === opt.v ? "bg-[#0A3855] text-white border-[#0A3855]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
            }`}
          >
            {opt.l}
          </button>
        ))}
        <select
          value={filterCommercialId || ""}
          onChange={(e) => setFilterCommercialId(e.target.value || null)}
          className="text-xs px-2 py-1 border border-gray-200 rounded bg-white hover:border-gray-300 ml-auto"
        >
          <option value="">Tous les commerciaux ({rows.length})</option>
          <option value="__unassigned__">— Non attribué ({unassignedCount})</option>
          {commercials.filter((c) => c.role === "system_none").map((c) => (
            <option key={c.id} value={c.id}>
              🚫 {c.name} ({countByCommercial.get(c.id) || 0})
            </option>
          ))}
          {commercials.filter((c) => c.role === "sales_admin" || c.role === "sales").map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({countByCommercial.get(c.id) || 0})
            </option>
          ))}
          {commercials.filter((c) => c.role === "upsell").map((c) => (
            <option key={c.id} value={c.id}>
              ⬆ {c.name} ({countByCommercial.get(c.id) || 0})
            </option>
          ))}
          {commercials.filter((c) => c.role === "support").map((c) => (
            <option key={c.id} value={c.id}>
              🛟 {c.name} ({countByCommercial.get(c.id) || 0})
            </option>
          ))}
          {commercials.filter((c) => c.role === "former").map((c) => (
            <option key={c.id} value={c.id}>
              💤 {c.name} ({countByCommercial.get(c.id) || 0})
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="🔍 Rechercher par nom ou email…"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setFilterMode("search"); }}
          className="text-xs px-2 py-1 border border-gray-200 rounded w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 sticky left-0 bg-gray-50">Email</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2 text-right">Net</th>
              <th className="px-2 py-2">Famille</th>
              <th className="px-2 py-2">1m / 3m</th>
              <th className="px-2 py-2">Attribution</th>
              <th className="px-2 py-2">Raison</th>
              <th className="px-2 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              // Tout négo authentifié peut flag N'IMPORTE QUELLE ligne (= "cette
              // vente devrait être à moi" ou "cette vente n'est pas la mienne").
              // Le manager arbitre via le dropdown d'attribution.
              const canFlagThisRow = canFlag;
              const isMine = !!myCommercialId && r.effective_commercial_id === myCommercialId;
              return (
              <RowComponent
                key={r.charge_id}
                row={r}
                commercials={commercials}
                editable={canEditAttribution}
                canAddNote={canAddNote}
                canFlag={canFlagThisRow}
                isMine={isMine}
                onOpenPanel={() => setPanelChargeId(r.charge_id)}
                openHistory={openHistoryId === r.charge_id}
                openNotes={openNotesId === r.charge_id}
                noteForm={noteFormChargeId === r.charge_id}
                noteText={noteFormChargeId === r.charge_id ? noteText : ""}
                onToggleHistory={() => setOpenHistoryId(openHistoryId === r.charge_id ? null : r.charge_id)}
                onToggleNotes={() => setOpenNotesId(openNotesId === r.charge_id ? null : r.charge_id)}
                onOpenNoteForm={() => { setNoteFormChargeId(r.charge_id); setNoteText(""); }}
                onCancelNoteForm={() => { setNoteFormChargeId(null); setNoteText(""); }}
                onChangeNoteText={setNoteText}
                onSubmitNote={() => addNote(r.charge_id)}
                onChangeAttribution={(cid) => changeAttribution(r.charge_id, cid)}
                onToggleFlag={async () => {
                  try {
                    const newFlag = !r.flagged_for_review;
                    const resp = await fetch(`/api/sales/flag/${encodeURIComponent(r.charge_id)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ flag: newFlag }),
                    });
                    if (!resp.ok) {
                      const err = await resp.json().catch(() => ({}));
                      throw new Error(err.error || `HTTP ${resp.status}`);
                    }
                    setRows((prev) => prev.map((rr) => rr.charge_id === r.charge_id ? { ...rr, flagged_for_review: newFlag } : rr));
                    showToast(newFlag ? "🚩 Attribution contestée" : "Contestation retirée");
                  } catch (e) {
                    showToast(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`, true);
                  }
                }}
              />
              );
            })}
            {filteredRows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Aucune ligne</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        {filteredRows.length} / {rows.length} lignes — {yearMonth} —{" "}
        {editable ? "Édition activée (sales_admin)" : "Lecture seule"}
      </p>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-sm shadow-lg z-50 ${toast.isError ? "bg-red-600" : "bg-[#0A3855]"}`}>
          {toast.msg}
        </div>
      )}

      {/* Panel chronologie HubSpot */}
      <EngagementPanel chargeId={panelChargeId} onClose={() => setPanelChargeId(null)} />
    </div>
  );
}

interface RowProps {
  row: RowData;
  commercials: CommercialOption[];
  editable: boolean;
  canAddNote: boolean;
  canFlag: boolean;
  isMine?: boolean;
  openHistory: boolean;
  openNotes: boolean;
  noteForm: boolean;
  noteText: string;
  onToggleHistory: () => void;
  onToggleNotes: () => void;
  onOpenNoteForm: () => void;
  onCancelNoteForm: () => void;
  onChangeNoteText: (t: string) => void;
  onSubmitNote: () => void;
  onChangeAttribution: (commercialId: string | null) => void;
  onToggleFlag: () => void;
  onOpenPanel: () => void;
}

function RowComponent({
  row, commercials, editable, canAddNote, canFlag, isMine,
  openHistory, openNotes, noteForm, noteText,
  onToggleHistory, onToggleNotes, onOpenNoteForm, onCancelNoteForm,
  onChangeNoteText, onSubmitNote, onChangeAttribution, onToggleFlag,
  onOpenPanel,
}: RowProps) {
  // Highlight subtilement les lignes qui me concernent dans la vue équipe.
  const rowClass = isMine
    ? "border-t border-gray-100 hover:bg-gray-50/40 bg-blue-50/30"
    : "border-t border-gray-100 hover:bg-gray-50/40";
  const cellBg = isMine ? "bg-blue-50/30" : "bg-white";
  return (
    <>
      <tr className={rowClass}>
        <td className={`px-3 py-2 sticky left-0 ${cellBg}`}>
          {isMine && <span className="mr-1 text-[#0A3855]" title="Attribuée à moi">●</span>}
          {row.client_name && (
            <div className="text-[12px] font-semibold text-gray-900">{row.client_name}</div>
          )}
          <div className="font-mono text-[11px] text-gray-500">{row.email}</div>
        </td>
        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(row.created_at)}</td>
        <td className="px-2 py-2 text-right font-mono tabular-nums">{fmtEur(row.amount_net_eur)}</td>
        <td className="px-2 py-2">{row.family || "—"}</td>
        <td className="px-2 py-2 text-[11px] text-gray-500">
          {row.newbiz_1m || "—"} / {row.newbiz_3m || "—"}
        </td>
        <td className="px-2 py-2">
          {editable ? (
            <div className="flex items-center gap-1.5">
              <select
                value={row.override_commercial_id || ""}
                onChange={(e) => onChangeAttribution(e.target.value || null)}
                className="text-[11px] px-1.5 py-1 border border-gray-200 rounded max-w-[160px]"
              >
                <option value="">— auto ({commercials.find((c) => c.id === row.auto_commercial_id)?.name || "—"})</option>
                {/* Cas spéciaux : achat autonome (pas de sales) ou support */}
                {commercials
                  .filter((c) => c.role === "system_none")
                  .map((c) => (
                    <option key={c.id} value={c.id}>🚫 {c.name}</option>
                  ))}
                <optgroup label="Sales">
                  {commercials
                    .filter((c) => c.role === "sales" || c.role === "sales_admin")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Upsell">
                  {commercials
                    .filter((c) => c.role === "upsell")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Support">
                  {commercials
                    .filter((c) => c.role === "support")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Anciens">
                  {commercials
                    .filter((c) => c.role === "former")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
              </select>
              <ScoreBadge score={row.auto_score} isOverride={row.is_override} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <ScoreBadge score={row.auto_score} isOverride={row.is_override} />
              <strong className="text-gray-900">{row.effective_commercial_name || "—"}</strong>
            </div>
          )}
          {row.flagged_for_review && (
            <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">🚩</span>
          )}
        </td>
        <td className="px-2 py-2 text-[11px]">
          <div className="font-medium text-gray-800">{row.is_override ? "Manuel" : (row.auto_source || "—")}</div>
          <div className="text-gray-500 leading-snug">{row.auto_reason || "—"}</div>
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-right">
          <button
            onClick={onOpenPanel}
            className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-[#0A3855] mr-1"
            title="Voir la chronologie HubSpot (Modjo / RDV / Aircall / notes)"
          >
            <Search className="w-3 h-3" />
          </button>
          {row.history.length > 0 && (
            <button
              onClick={onToggleHistory}
              className="inline-flex items-center gap-0.5 text-[10px] text-gray-600 hover:text-[#0A3855] mr-1"
              title={`${row.history.length} modification(s)`}
            >
              <History className="w-3 h-3" /> {row.history.length}
            </button>
          )}
          {row.notes.length > 0 && (
            <button
              onClick={onToggleNotes}
              className="inline-flex items-center gap-0.5 text-[10px] text-gray-600 hover:text-[#0A3855] mr-1"
              title={`${row.notes.length} note(s)`}
            >
              <MessageSquare className="w-3 h-3" /> {row.notes.length}
            </button>
          )}
          {canAddNote && !noteForm && (
            <button
              onClick={onOpenNoteForm}
              className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#0A3855]"
              title="Ajouter une note"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          {canFlag && (
            <button
              onClick={onToggleFlag}
              className={`inline-flex items-center gap-0.5 text-[10px] ml-1 hover:text-orange-700 ${row.flagged_for_review ? "text-orange-600" : "text-gray-400"}`}
              title={
                row.flagged_for_review
                  ? "Retirer la contestation"
                  : isMine
                    ? "Cette vente ne devrait pas m'être attribuée (contester)"
                    : "Cette vente devrait m'être attribuée (revendiquer)"
              }
            >
              <Flag className="w-3 h-3" />
            </button>
          )}
        </td>
      </tr>
      {openHistory && row.history.length > 0 && (
        <tr className="bg-blue-50/30">
          <td colSpan={8} className="px-3 py-2">
            <div className="text-[11px]">
              <strong className="text-[#0A3855]">Historique :</strong>
              <ul className="mt-1 space-y-0.5">
                {row.history.map((h) => (
                  <li key={h.id} className="text-gray-700">
                    <span className="text-gray-400 font-mono">{fmtDt(h.when_at)}</span>{" "}
                    <strong>{h.who_email}</strong> : {h.from_commercial} → {h.to_commercial}
                    {h.comment ? <em className="text-gray-500"> — {h.comment}</em> : ""}
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
      {openNotes && row.notes.length > 0 && (
        <tr className="bg-amber-50/30">
          <td colSpan={8} className="px-3 py-2">
            <div className="text-[11px]">
              <strong className="text-[#0A3855]">Notes :</strong>
              <ul className="mt-1 space-y-0.5">
                {row.notes.map((n) => (
                  <li key={n.id} className="text-gray-700">
                    <span className="text-gray-400 font-mono">{fmtDt(n.when_at)}</span>{" "}
                    <strong>{n.author_email}</strong> : {n.text}
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
      {noteForm && (
        <tr className="bg-amber-50/50">
          <td colSpan={8} className="px-3 py-2">
            <div className="flex gap-2 items-start">
              <textarea
                value={noteText}
                onChange={(e) => onChangeNoteText(e.target.value)}
                placeholder="Ex : Hasan a closé alors que Driss avait pris le RDV initial"
                rows={2}
                className="flex-1 text-[11px] px-2 py-1.5 border border-gray-300 rounded resize-y"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={onSubmitNote}
                  disabled={!noteText.trim()}
                  className="text-[11px] px-3 py-1 bg-[#0A3855] text-white rounded disabled:opacity-40"
                >Enregistrer</button>
                <button
                  onClick={onCancelNoteForm}
                  className="text-[11px] px-3 py-1 border border-gray-200 rounded"
                >Annuler</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
