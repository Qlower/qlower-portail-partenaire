import { createServiceClient } from "@/lib/supabase-server";
import EquipeManager from "@/components/internal/EquipeManager";

export default async function EquipeAdminPage() {
  const sb = createServiceClient();
  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, email, hubspot_owner_id, role, active, share_fraction")
    .order("active", { ascending: false })
    .order("name");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">Gestion équipe</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajout / désactivation de négos. La part d&apos;objectif sert à calculer
          les cibles mensuelles automatiquement (somme = 1.0 idéalement).
        </p>
      </div>
      <EquipeManager commercials={commercials || []} />
    </div>
  );
}
