"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Commercial {
  id: string;
  name: string;
  role: string;
}

interface Props {
  /** Vue actuellement sélectionnée :
   *   "team" | "self" | commercial_id | "unassigned" | special role group ("autonome", "support", "former") */
  current: string;
  commercials: Commercial[];
  /** Si true, l'option "Équipe entière" est proposée (admin only) */
  allowTeam: boolean;
  /** Commercial_id de l'utilisateur connecté pour afficher "Moi" */
  myCommercialId: string | null;
  /** Nb de lignes par catégorie pour afficher les compteurs */
  counts: {
    team: number;
    byCommercialId: Record<string, number>;
    unassigned: number;
    autonome: number;
    support: number;
    former: number;
  };
}

/**
 * Dropdown unique qui contrôle :
 *   - Le speedometer (PersonalObjective)
 *   - Le filtre des lignes du tableau (AttributionTable)
 *
 * URL param `?view=` (omis si "team" = défaut admin).
 */
export default function ObjectiveViewSelector({
  current,
  commercials,
  allowTeam,
  myCommercialId,
  counts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "team" && allowTeam) {
      params.delete("view"); // défaut admin → URL clean
    } else {
      params.set("view", view);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Tri intra-groupe : moi en premier dans son groupe
  const sortInGroup = (a: Commercial, b: Commercial) => {
    if (a.id === myCommercialId) return -1;
    if (b.id === myCommercialId) return 1;
    return a.name.localeCompare(b.name);
  };

  const salesActifs = commercials
    .filter((c) => c.role === "sales" || c.role === "sales_admin" || c.role === "upsell")
    .sort(sortInGroup);

  const anciens = commercials.filter((c) => c.role === "former").sort(sortInGroup);
  const supports = commercials.filter((c) => c.role === "support");

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
        Vue :
      </label>
      <select
        value={current}
        onChange={(e) => navigate(e.target.value)}
        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white hover:border-gray-300 font-medium text-[#0A3855] max-w-[260px]"
      >
        {allowTeam && (
          <option value="team">🏆 Équipe entière ({counts.team})</option>
        )}

        <optgroup label="— Sales actifs —">
          {salesActifs.map((c) => {
            const n = counts.byCommercialId[c.id] || 0;
            const isMe = c.id === myCommercialId;
            const tag = c.role === "upsell" ? " · upsell" : c.role === "sales_admin" ? " · admin" : "";
            return (
              <option key={c.id} value={c.id}>
                {isMe ? "👤 " : ""}
                {c.name}
                {isMe ? " (moi)" : ""}
                {tag} ({n})
              </option>
            );
          })}
        </optgroup>

        {(counts.unassigned > 0 || counts.autonome > 0 || supports.length > 0) && (
          <optgroup label="— Spécial —">
            {counts.unassigned > 0 && (
              <option value="unassigned">⏵ Non attribué ({counts.unassigned})</option>
            )}
            {counts.autonome > 0 && (
              <option value="autonome">🚫 Achats autonomes ({counts.autonome})</option>
            )}
            {supports.length > 0 && (
              <option value="support">🛟 Support ({counts.support})</option>
            )}
          </optgroup>
        )}

        {anciens.length > 0 && counts.former > 0 && (
          <optgroup label="— Anciens —">
            <option value="former">💤 Anciens collaborateurs ({counts.former})</option>
          </optgroup>
        )}
      </select>
    </div>
  );
}
