"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, MessageSquare, Flag, Plus, Search, Wallet } from "lucide-react";
import EngagementPanel from "./EngagementPanel";
import { hubspotSearchByEmailUrl } from "@/lib/hubspot-urls";

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
  amount_gross_eur?: number;
  amount_refunded_eur?: number;
  refunded_after_lock?: boolean;
  // Override admin du montant commissionnable (ex: upsell où seul le delta
  // compte, refund partiel, etc.). NULL = on commissionne sur amount_net_eur.
  commissionable_amount_eur?: number | null;
  commissionable_adjusted_reason?: string | null;
  commissionable_adjusted_by_email?: string | null;
  commissionable_adjusted_at?: string | null;
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
  // Auteur de la contestation : user_id Supabase Auth (pour le check
  // d'ownership) + nom + email résolus serveur-side via la table commercials.
  flagged_by_user_id?: string | null;
  flagged_by_name?: string | null;
  flagged_by_email?: string | null;
  flagged_at?: string | null;
  // Refund-after-lock : décision admin (NULL=pending | acknowledged_no_clawback | applied)
  clawback_status?: string | null;
  clawback_amount_eur?: number | null;
  clawback_decided_by_email?: string | null;
  clawback_applied_at?: string | null;
  clawback_reason?: string | null;
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
  /** Supabase Auth user_id du user courant — pour le check "puis-je retirer cette contestation ?" */
  myUserId?: string | null;
  /** True si le user courant est sales_admin (peut retirer toute contestation) */
  isSalesAdmin?: boolean;
  /** If true, the "Mes ventes" filter is preselected on mount */
  defaultFilterMine?: boolean;
  /** Vue active (depuis le dropdown unifié VUE) : "team" | commercial_id |
   * "unassigned" | "autonome" | "support" | "former". Si "team", pas de filtre. */
  view?: string;
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtDate = (iso: string) => iso.slice(0, 10);
const fmtDt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

type SortableSortKey = "email" | "date" | "net" | "family" | "newbiz" | "attribution" | "reason";

function SortableTh({
  sortKey,
  currentKey,
  dir,
  onClick,
  className,
  children,
}: {
  sortKey: SortableSortKey;
  currentKey: SortableSortKey;
  dir: "asc" | "desc";
  onClick: (k: SortableSortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = currentKey === sortKey;
  const arrow = isActive ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      className={`${className || ""} cursor-pointer select-none hover:bg-gray-100 transition-colors`}
      onClick={() => onClick(sortKey)}
      title={`Trier par ${typeof children === "string" ? children : sortKey}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[10px] ${isActive ? "text-[#0A3855] font-bold" : "text-gray-300"}`}>
          {arrow || "↕"}
        </span>
      </span>
    </th>
  );
}

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
  myUserId,
  isSalesAdmin,
  defaultFilterMine,
  view,
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
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "flagged" | "manual" | "low_score" | "search" | "refunded">(
    defaultFilterMine ? "mine" : "all",
  );
  // Filtre commercial / vue spéciale unifié avec la prop `view` (= URL ?view=).
  // - "team" ou undefined → toutes les lignes
  // - "unassigned" → lignes sans commercial attribué
  // - "autonome" → role=system_none
  // - "support" → role=support
  // - "former" → role=former
  // - commercial_id → ses lignes
  // Charge dont on affiche le panel HubSpot timeline (null = panel fermé)
  const [panelChargeId, setPanelChargeId] = useState<string | null>(null);
  // Charge dont on ajuste le montant commissionnable (null = modal fermé)
  const [adjustingChargeId, setAdjustingChargeId] = useState<string | null>(null);
  // Tri des colonnes — par défaut : date la plus récente en haut
  type SortKey = "email" | "date" | "net" | "family" | "newbiz" | "attribution" | "reason";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Par défaut : numérique = desc (plus grand en haut), texte = asc
      setSortDir(key === "net" || key === "date" ? "desc" : "asc");
    }
  }
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
    if (filterMode === "refunded" && !(r.amount_refunded_eur && r.amount_refunded_eur > 0)) return false;
    if (filterMode === "search" && filter) {
      const q = filter.toLowerCase();
      const haystack = [
        r.email.toLowerCase(),
        (r.client_name || "").toLowerCase(),
        r.email.split("@")[0].toLowerCase().replace(/[._-]/g, " "),
      ].join(" ");
      if (!haystack.includes(q)) return false;
    }
    // Filtre via la prop `view` (sync avec le dropdown VUE en haut)
    if (view && view !== "team") {
      if (view === "unassigned") {
        if (r.effective_commercial_id) return false;
      } else if (view === "autonome" || view === "support" || view === "former") {
        const roleMap: Record<string, string> = {
          autonome: "system_none",
          support: "support",
          former: "former",
        };
        const targetRole = roleMap[view];
        const c = commercials.find((cc) => cc.id === r.effective_commercial_id);
        if (!c || c.role !== targetRole) return false;
      } else {
        // commercial_id classique
        if (r.effective_commercial_id !== view) return false;
      }
    }
    return true;
  });

  const myRowsCount = myCommercialId
    ? rows.filter((r) => r.effective_commercial_id === myCommercialId).length
    : 0;

  // Tri dynamique selon la colonne cliquée. Défaut : date desc (récent en haut).
  // Pour l'attribution : on trie par nom du commercial effectif (asc/desc).
  filteredRows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "email":
        cmp = (a.client_name || a.email).localeCompare(b.client_name || b.email);
        break;
      case "date":
        cmp = (a.created_at || "").localeCompare(b.created_at || "");
        break;
      case "net":
        cmp = a.amount_net_eur - b.amount_net_eur;
        break;
      case "family":
        cmp = (a.family || "").localeCompare(b.family || "");
        break;
      case "newbiz":
        cmp = (a.newbiz_1m || "").localeCompare(b.newbiz_1m || "");
        break;
      case "attribution": {
        const nameA = commercials.find((c) => c.id === a.effective_commercial_id)?.name || "ZZZ";
        const nameB = commercials.find((c) => c.id === b.effective_commercial_id)?.name || "ZZZ";
        cmp = nameA.localeCompare(nameB);
        break;
      }
      case "reason":
        cmp = (a.auto_score ?? 0) - (b.auto_score ?? 0);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

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

  // Ajuste le montant commissionnable d'une ligne (ex: upsell où seul le delta
  // compte). amount=null → retire l'override (retour au net Stripe).
  async function adjustCommissionable(
    chargeId: string,
    amount: number | null,
    reason: string,
  ) {
    try {
      const url = `/api/sales/commissionable/${encodeURIComponent(chargeId)}`;
      const r = await fetch(url, {
        method: amount === null ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: amount === null ? undefined : JSON.stringify({ amount, reason }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erreur");
      const data = await r.json();
      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((rr) =>
          rr.charge_id === chargeId
            ? {
                ...rr,
                commissionable_amount_eur: amount,
                commissionable_adjusted_reason: amount === null ? null : reason,
                commissionable_adjusted_by_email: amount === null ? null : data.commissionable_adjusted_by_email || null,
                commissionable_adjusted_at: amount === null ? null : now,
                history: [
                  {
                    id: String(Date.now()),
                    when_at: now,
                    who_email: data.commissionable_adjusted_by_email || null,
                    from_commercial: `Commissionable : ${Math.round(Number(rr.commissionable_amount_eur ?? rr.amount_net_eur))} €`,
                    to_commercial:
                      amount === null
                        ? `Commissionable : ${Math.round(rr.amount_net_eur)} € (auto)`
                        : `Commissionable : ${Math.round(amount)} €`,
                    comment: amount === null ? "Override retiré" : reason,
                  },
                  ...rr.history,
                ],
              }
            : rr,
        ),
      );
      showToast(amount === null ? "Override retiré" : `Commissionable → ${Math.round(amount).toLocaleString("fr-FR")} €`);
      startTransition(() => router.refresh());
    } catch (e) {
      console.error("[attribution] adjustCommissionable failed", e);
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
          { v: "refunded", l: `↩ Remboursées (${rows.filter((r) => r.amount_refunded_eur && r.amount_refunded_eur > 0).length})`, hidden: rows.filter((r) => r.amount_refunded_eur && r.amount_refunded_eur > 0).length === 0 },
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
        <input
          type="search"
          placeholder="🔍 Rechercher par nom ou email…"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setFilterMode("search"); }}
          className="text-xs px-2 py-1 border border-gray-200 rounded w-64 ml-auto"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <SortableTh sortKey="email" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-3 py-2 sticky left-0 bg-gray-50">
                Client / Email
              </SortableTh>
              <SortableTh sortKey="date" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2">
                Date
              </SortableTh>
              <SortableTh sortKey="net" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2 text-right">
                Net
              </SortableTh>
              <SortableTh sortKey="family" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2">
                Famille
              </SortableTh>
              <SortableTh sortKey="newbiz" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2">
                1m / 3m
              </SortableTh>
              <SortableTh sortKey="attribution" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2">
                Attribution
              </SortableTh>
              <SortableTh sortKey="reason" currentKey={sortKey} dir={sortDir} onClick={toggleSort} className="px-2 py-2">
                Score / Raison
              </SortableTh>
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
                myUserId={myUserId}
                isSalesAdmin={isSalesAdmin}
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
                onOpenAdjust={() => setAdjustingChargeId(r.charge_id)}
                onToggleFlag={async () => {
                  const newFlag = !r.flagged_for_review;

                  // Cas DÉFLAGGER : vérif ownership côté client (UX rapide).
                  // L'API revérifiera de toute façon (défense en profondeur).
                  if (!newFlag) {
                    const isOriginalFlagger = !!myUserId && r.flagged_by_user_id === myUserId;
                    if (!isOriginalFlagger && !isSalesAdmin) {
                      const by = r.flagged_by_name || "l'auteur";
                      showToast(`Seul ${by} ou un manager peut retirer cette contestation`, true);
                      return;
                    }
                  }

                  // Cas FLAGGER : motif obligatoire
                  let reason: string | null = null;
                  if (newFlag) {
                    const input = window.prompt(
                      "Pourquoi contester cette attribution ?\n\n" +
                        "(5 caractères minimum — soit pour la revendiquer si tu penses qu'elle devrait t'être attribuée, soit pour la rejeter si tu penses qu'elle ne devrait pas l'être)",
                      "",
                    );
                    if (input === null) return; // annulé
                    reason = input.trim();
                    if (reason.length < 5) {
                      showToast("Le motif doit faire au moins 5 caractères", true);
                      return;
                    }
                  }

                  try {
                    const resp = await fetch(`/api/sales/flag/${encodeURIComponent(r.charge_id)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ flag: newFlag, reason }),
                    });
                    if (!resp.ok) {
                      const err = await resp.json().catch(() => ({}));
                      throw new Error(err.error || `HTTP ${resp.status}`);
                    }
                    const data = await resp.json().catch(() => ({}));
                    setRows((prev) =>
                      prev.map((rr) =>
                        rr.charge_id === r.charge_id
                          ? {
                              ...rr,
                              flagged_for_review: newFlag,
                              flagged_reason: newFlag ? reason : null,
                              flagged_by_user_id: newFlag ? (data.flagged_by ?? myUserId ?? null) : null,
                              flagged_by_name: newFlag ? (data.flagged_by_name ?? null) : null,
                              flagged_by_email: newFlag ? (data.flagged_by_email ?? null) : null,
                              flagged_at: newFlag ? (data.flagged_at ?? new Date().toISOString()) : null,
                            }
                          : rr,
                      ),
                    );
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

      {/* Modal d'ajustement du montant commissionnable */}
      {adjustingChargeId && (() => {
        const row = rows.find((r) => r.charge_id === adjustingChargeId);
        if (!row) return null;
        return (
          <AdjustCommissionableModal
            row={row}
            onClose={() => setAdjustingChargeId(null)}
            onSubmit={async (amount, reason) => {
              await adjustCommissionable(adjustingChargeId, amount, reason);
              setAdjustingChargeId(null);
            }}
            onRemove={async () => {
              await adjustCommissionable(adjustingChargeId, null, "");
              setAdjustingChargeId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

// ─── Modal d'ajustement du montant commissionnable ─────────────────────────
function AdjustCommissionableModal({
  row,
  onClose,
  onSubmit,
  onRemove,
}: {
  row: RowData;
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}) {
  const current =
    row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined
      ? Number(row.commissionable_amount_eur)
      : row.amount_net_eur;
  const [amount, setAmount] = useState<string>(String(Math.round(current)));
  const [reason, setReason] = useState(row.commissionable_adjusted_reason || "");
  const [submitting, setSubmitting] = useState(false);

  // Une ligne refund est une ligne ledger NÉGATIVE (auto_source =
  // stripe_refund_ledger ou manual_refund_ledger). Le contexte d'override
  // est inversé : amount=0 signifie "ne pas décommissionner" (la boîte
  // assume le refund), pas "décommissionner totalement".
  const isRefundLine =
    row.auto_source === "stripe_refund_ledger" ||
    row.auto_source === "manual_refund_ledger";

  const presets: Array<{ label: string; reason: string; amountFn?: () => number }> = isRefundLine
    ? [
        {
          label: "Ne pas décommissionner — la boîte assume",
          reason: "Refund assumé par la boîte : le commercial garde son commissionnement",
          amountFn: () => 0,
        },
        {
          label: "Décompte partiel",
          reason: "Refund partiellement décompté du commercial",
        },
      ]
    : [
        { label: "Upsell — delta seulement", reason: "Upsell : client déjà abonné, commission sur le delta" },
        { label: "Refund partiel", reason: "Remboursement partiel sur cette charge" },
        { label: "Décommissionnement", reason: "Décommissionnement (refund après paie versée)", amountFn: () => 0 },
      ];

  const hasOverride =
    row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined;
  const numericAmount = Number(amount);
  const canSubmit =
    !isNaN(numericAmount) && reason.trim().length > 0 && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 mb-3">
          <Wallet className="size-5 text-amber-600 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-[#0A3855]">
              Ajuster le montant commissionnable
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {row.email} · {fmtEur(row.amount_net_eur)} net Stripe
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Le commercial sera commissionné sur
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-mono"
                placeholder="210"
                autoFocus
              />
              <span className="text-sm text-gray-500">€</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {isRefundLine ? (
                <>
                  Ligne <strong>refund</strong> (montant négatif). Mets <strong>0</strong> pour
                  ne <strong>pas</strong> décommissionner le commercial (la boîte assume le refund),
                  ou garde le montant pour décompter normalement.
                </>
              ) : (
                <>
                  Au lieu de {fmtEur(row.amount_net_eur)} (net Stripe). Mets <strong>0</strong> pour
                  décommissionner totalement, ou un montant négatif pour clawback.
                </>
              )}
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Motif (obligatoire — pour audit)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 mt-1"
              placeholder={isRefundLine ? "Ex: Refund assumé par Qlower — erreur de notre part" : "Ex: Upsell — contrat préexistant à 269€"}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-gray-500 self-center">Raccourcis :</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  if (p.amountFn) setAmount(String(p.amountFn()));
                  setReason(p.reason);
                }}
                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
          {hasOverride ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Retirer l'override ? La commission repassera sur le net Stripe.")) return;
                setSubmitting(true);
                try {
                  await onRemove();
                } finally {
                  setSubmitting(false);
                }
              }}
              className="text-xs text-rose-600 hover:underline"
              disabled={submitting}
            >
              Retirer l&apos;override
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
              disabled={submitting}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!canSubmit) return;
                setSubmitting(true);
                try {
                  await onSubmit(numericAmount, reason.trim());
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={!canSubmit}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? "Sauvegarde…" : "Appliquer"}
            </button>
          </div>
        </div>
      </div>
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
  // Pour vérifier si le user courant peut RETIRER la contestation en cours :
  // il faut être l'auteur OU être sales_admin.
  myUserId?: string | null;
  isSalesAdmin?: boolean;
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
  onOpenAdjust: () => void;
}

function RowComponent({
  row, commercials, editable, canAddNote, canFlag, isMine, myUserId, isSalesAdmin,
  openHistory, openNotes, noteForm, noteText,
  onToggleHistory, onToggleNotes, onOpenNoteForm, onCancelNoteForm,
  onChangeNoteText, onSubmitNote, onChangeAttribution, onToggleFlag,
  onOpenPanel, onOpenAdjust,
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
            <a
              href={hubspotSearchByEmailUrl(row.email)}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold text-gray-900 hover:text-[#0A3855] hover:underline block"
              title="Ouvrir dans HubSpot"
            >
              {row.client_name}
            </a>
          )}
          <a
            href={hubspotSearchByEmailUrl(row.email)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-gray-500 hover:text-[#0A3855] hover:underline"
            title="Ouvrir dans HubSpot"
          >
            {row.email}
          </a>
        </td>
        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(row.created_at)}</td>
        <td className="px-2 py-2 text-right font-mono tabular-nums">
          <div className="flex flex-col items-end gap-0.5">
            {row.amount_refunded_eur && row.amount_refunded_eur > 0 ? (
              <>
                <span className={row.amount_net_eur === 0 ? "text-gray-400 line-through" : ""}>
                  {fmtEur(row.amount_net_eur)}
                </span>
                <span
                  className={`text-[10px] inline-flex items-center gap-0.5 ${row.refunded_after_lock ? "text-orange-600 font-semibold" : "text-red-600"}`}
                  title={
                    row.refunded_after_lock
                      ? `⚠️ Remboursement post-clôture : ${fmtEur(row.amount_refunded_eur)} (commission probablement déjà versée, prévoir clawback)`
                      : `Remboursé : ${fmtEur(row.amount_refunded_eur)} sur ${fmtEur(row.amount_gross_eur || 0)} brut`
                  }
                >
                  {row.refunded_after_lock ? "⚠️" : "↩"} −{fmtEur(row.amount_refunded_eur)}
                </span>
              </>
            ) : (
              <span>{fmtEur(row.amount_net_eur)}</span>
            )}
            {/* Override admin du montant commissionnable (ex: upsell, refund partiel) */}
            {row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined && (
              <span
                className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold"
                title={
                  `Commissionné sur ${fmtEur(Number(row.commissionable_amount_eur))} (au lieu de ${fmtEur(row.amount_net_eur)})` +
                  (row.commissionable_adjusted_reason ? ` — ${row.commissionable_adjusted_reason}` : "") +
                  (row.commissionable_adjusted_by_email ? ` (par ${row.commissionable_adjusted_by_email})` : "")
                }
              >
                💰 {fmtEur(Number(row.commissionable_amount_eur))}
              </span>
            )}
          </div>
        </td>
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
            <span
              className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 cursor-help"
              title={
                `🚩 Contestation en cours` +
                (row.flagged_by_name ? `\n— par : ${row.flagged_by_name}` : "") +
                (row.flagged_at
                  ? `\n— le ${new Date(row.flagged_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
                  : "") +
                (row.flagged_reason ? `\n\nMotif : ${row.flagged_reason}` : "")
              }
            >
              🚩
              {row.flagged_by_name && (
                <span className="font-normal opacity-80 max-w-[80px] truncate hidden sm:inline">
                  {row.flagged_by_name.split(" ")[0]}
                </span>
              )}
            </span>
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
          {canFlag && (() => {
            // Si une contestation est déjà active, seul son auteur ou un admin
            // peut la retirer. Pour les autres on désactive le bouton mais on
            // affiche un tooltip explicite.
            const canRemoveFlag =
              !row.flagged_for_review ||
              !!isSalesAdmin ||
              (!!myUserId && row.flagged_by_user_id === myUserId);

            const tooltipFlagged =
              `🚩 Contestation en cours` +
              (row.flagged_by_name ? `\nPar : ${row.flagged_by_name}` : "") +
              (row.flagged_at
                ? `\nLe ${new Date(row.flagged_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
                : "") +
              (row.flagged_reason ? `\n\nMotif : ${row.flagged_reason}` : "") +
              (canRemoveFlag
                ? `\n\nClique pour retirer la contestation.`
                : `\n\n⚠️ Tu ne peux pas retirer la contestation d'un autre — seul ${row.flagged_by_name || "l'auteur"} ou un manager peut le faire.`);

            return (
              <button
                onClick={onToggleFlag}
                disabled={row.flagged_for_review && !canRemoveFlag}
                className={`inline-flex items-center gap-0.5 text-[10px] ml-1 transition-colors ${
                  row.flagged_for_review
                    ? canRemoveFlag
                      ? "text-orange-600 hover:text-orange-700"
                      : "text-orange-300 cursor-not-allowed"
                    : "text-gray-400 hover:text-orange-700"
                }`}
                title={
                  row.flagged_for_review
                    ? tooltipFlagged
                    : isMine
                      ? "Cette vente ne devrait pas m'être attribuée — clique pour contester (motif obligatoire)"
                      : "Cette vente devrait m'être attribuée — clique pour la revendiquer (motif obligatoire)"
                }
              >
                <Flag className="w-3 h-3" />
              </button>
            );
          })()}
          {editable && (
            <button
              onClick={onOpenAdjust}
              className={`inline-flex items-center gap-0.5 text-[10px] ml-1 hover:text-amber-700 ${
                row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined
                  ? "text-amber-600"
                  : "text-gray-400"
              }`}
              title={
                row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined
                  ? `Modifier le montant commissionnable (actuel : ${Math.round(Number(row.commissionable_amount_eur)).toLocaleString("fr-FR")} €)`
                  : "Ajuster le montant commissionnable (ex: upsell)"
              }
            >
              <Wallet className="w-3 h-3" />
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
