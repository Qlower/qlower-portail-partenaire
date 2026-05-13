"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Commercial {
  id: string;
  name: string;
  role: string;
}

interface Props {
  /** Vue actuellement sélectionnée : "team" | "self" | commercial_id */
  current: string;
  /** Liste des commerciaux affichables dans le dropdown */
  commercials: Commercial[];
  /** Si true, l'option "Équipe entière" est proposée (admin only) */
  allowTeam: boolean;
  /** Commercial_id de l'utilisateur connecté pour afficher "Moi" si présent */
  myCommercialId: string | null;
}

/**
 * Dropdown qui permet au manager de basculer le speedometer entre :
 *   - Équipe entière (défaut admin)
 *   - Lui-même ("Moi")
 *   - N'importe quel autre commercial
 *
 * Met à jour le query param `?view=` → la page server re-render avec la vue
 * choisie, sans recharger ni perdre l'état.
 */
export default function ObjectiveViewSelector({ current, commercials, allowTeam, myCommercialId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "team" && allowTeam) {
      // "team" = défaut admin, on peut omettre le param pour simplifier l'URL
      params.delete("view");
    } else {
      params.set("view", view);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Tri : Moi en haut, puis sales/sales_admin, puis upsell, puis le reste
  const sorted = [...commercials].sort((a, b) => {
    if (a.id === myCommercialId) return -1;
    if (b.id === myCommercialId) return 1;
    const order = (r: string) => (r === "sales_admin" ? 0 : r === "sales" ? 1 : r === "upsell" ? 2 : 3);
    return order(a.role) - order(b.role) || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
        Vue :
      </label>
      <select
        value={current}
        onChange={(e) => navigate(e.target.value)}
        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white hover:border-gray-300 font-medium text-[#0A3855]"
      >
        {allowTeam && <option value="team">🏆 Équipe entière</option>}
        {sorted.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id === myCommercialId ? "👤 " : ""}
            {c.name}
            {c.id === myCommercialId ? " (moi)" : ""}
            {c.role === "upsell" ? " · upsell" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
