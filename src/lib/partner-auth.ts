import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/admin-auth";

// Vérifie que l'appelant a le droit d'accéder aux données du partenaire `partnerId`.
// Autorisé si : admin Qlower, OU l'utilisateur est rattaché à ce partenaire
// (user_metadata.partner_id, ou partners.user_id = user.id en fallback).
//
// Ferme l'IDOR : sans ça, n'importe qui pouvait lire les données d'un affilié
// via ?partner_id=... (routes en service_role qui bypassent la RLS).
export async function verifyPartnerAccess(
  request: NextRequest,
  partnerId: string | null | undefined,
): Promise<{ error?: NextResponse }> {
  if (!partnerId) {
    return { error: NextResponse.json({ error: "partner_id is required" }, { status: 400 }) };
  }

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
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  // Admin : accès total (impersonation incluse).
  if (ADMIN_EMAILS.includes(user.email || "")) return {};

  // Rattachement direct via metadata.
  if ((user.user_metadata as Record<string, unknown> | undefined)?.partner_id === partnerId) {
    return {};
  }

  // Fallback : propriété via user_id (metadata éventuellement obsolète).
  const sb = createServiceClient();
  const { data: owned } = await sb
    .from("partners")
    .select("id")
    .eq("id", partnerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (owned) return {};

  return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}
