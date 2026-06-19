import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/admin-auth";

// Vérifie qu'une requête vient d'un utilisateur "master" (siège réseau) et
// renvoie le network_id auquel il est rattaché.
//
// Source de vérité = table `network_members` (multi-utilisateur natif) ;
// fallback sur user_metadata.network_id (mirroir posé au provisioning, sert
// surtout au routing). Le network_id n'est JAMAIS lu depuis l'URL → cloisonnement.
export async function verifyMaster(
  request: NextRequest,
): Promise<{ networkId?: string; userId?: string; isAdmin?: boolean; error?: NextResponse }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  // Impersonation admin : un admin Qlower peut consulter le siège de N'IMPORTE
  // quel réseau via ?network=. Réservé aux admins (un vrai master ne peut JAMAIS
  // changer de réseau par l'URL — son network_id vient de network_members).
  const isAdmin = ADMIN_EMAILS.includes(user.email || "");
  if (isAdmin) {
    const queryNetwork = new URL(request.url).searchParams.get("network");
    if (queryNetwork) {
      return { networkId: queryNetwork, userId: user.id, isAdmin: true };
    }
  }

  const sb = createServiceClient();
  const { data: members } = await sb
    .from("network_members")
    .select("network_id")
    .eq("user_id", user.id)
    .limit(1);

  const networkId =
    members?.[0]?.network_id ||
    ((user.user_metadata as Record<string, unknown> | undefined)?.network_id as string | undefined);

  if (!networkId) {
    return { error: NextResponse.json({ error: "Master access required" }, { status: 403 }) };
  }

  return { networkId, userId: user.id, isAdmin };
}
