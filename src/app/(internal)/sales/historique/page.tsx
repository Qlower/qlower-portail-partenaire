import { createServiceClient } from "@/lib/supabase-server";

const MONTHS_FR: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
};

interface HistoryRow {
  id: string;
  charge_id: string;
  who_email: string | null;
  from_commercial: string | null;
  to_commercial: string | null;
  comment: string | null;
  when_at: string;
  email: string | null;     // joined from attribution_rows
  amount_net_eur: number | null;
}

interface NoteRow {
  id: string;
  charge_id: string;
  author_email: string | null;
  text: string;
  when_at: string;
  email: string | null;
  amount_net_eur: number | null;
}

async function loadHistory() {
  const sb = createServiceClient();

  const { data: edits } = await sb
    .from("attribution_history")
    .select("id, charge_id, who_email, from_commercial, to_commercial, comment, when_at")
    .order("when_at", { ascending: false })
    .limit(100);

  const { data: notes } = await sb
    .from("attribution_notes")
    .select("id, charge_id, author_email, text, when_at")
    .order("when_at", { ascending: false })
    .limit(100);

  // Hydrate with the corresponding row info (email + amount)
  const allChargeIds = [
    ...new Set([
      ...(edits || []).map((e) => e.charge_id),
      ...(notes || []).map((n) => n.charge_id),
    ]),
  ];
  const rowInfo = new Map<string, { email: string; amount_net_eur: number }>();
  if (allChargeIds.length) {
    const { data: rs } = await sb
      .from("attribution_rows")
      .select("charge_id, email, amount_net_eur")
      .in("charge_id", allChargeIds);
    for (const r of rs || []) rowInfo.set(r.charge_id, { email: r.email, amount_net_eur: r.amount_net_eur });
  }

  const editsHydrated: HistoryRow[] = (edits || []).map((e) => ({
    ...e,
    email: rowInfo.get(e.charge_id)?.email || null,
    amount_net_eur: rowInfo.get(e.charge_id)?.amount_net_eur ?? null,
  }));
  const notesHydrated: NoteRow[] = (notes || []).map((n) => ({
    ...n,
    email: rowInfo.get(n.charge_id)?.email || null,
    amount_net_eur: rowInfo.get(n.charge_id)?.amount_net_eur ?? null,
  }));

  return { edits: editsHydrated, notes: notesHydrated };
}

const fmtDt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

const fmtEur = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} €`);

export default async function HistoriquePage() {
  const { edits, notes } = await loadHistory();

  // Merge into a single chronological feed
  type FeedItem =
    | { kind: "edit"; row: HistoryRow }
    | { kind: "note"; row: NoteRow };
  const feed: FeedItem[] = [
    ...edits.map((e) => ({ kind: "edit" as const, row: e })),
    ...notes.map((n) => ({ kind: "note" as const, row: n })),
  ];
  feed.sort((a, b) => (a.row.when_at < b.row.when_at ? 1 : -1));

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">Historique</h1>
        <p className="text-sm text-gray-500 mt-1">
          Toutes les éditions et notes de l&apos;équipe — append-only, transparence totale
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
          Aucune édition ni note pour le moment.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Quand</th>
                <th className="px-3 py-2">Qui</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2">Détail</th>
              </tr>
            </thead>
            <tbody>
              {feed.map((item, i) => (
                <tr key={`${item.kind}-${item.row.id}-${i}`} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDt(item.row.when_at)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <strong>
                      {item.kind === "edit" ? item.row.who_email || "—" : item.row.author_email || "—"}
                    </strong>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {item.kind === "edit" ? "✏️ Édition" : "💬 Note"}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    {item.row.email || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono tabular-nums text-gray-500">
                    {fmtEur(item.row.amount_net_eur)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-md">
                    {item.kind === "edit" ? (
                      <>
                        <strong>{item.row.from_commercial || "—"}</strong>
                        <span className="mx-1 text-gray-400">→</span>
                        <strong className="text-[#0A3855]">{item.row.to_commercial || "—"}</strong>
                        {item.row.comment ? <em className="block text-gray-500 mt-0.5">{item.row.comment}</em> : null}
                      </>
                    ) : (
                      <span>{item.row.text}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        100 dernières éditions + 100 dernières notes affichées.
      </p>
    </div>
  );
}
