import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export type InternalRole = "sales" | "sales_admin";

export interface SalesAuthResult {
  user_id: string;
  email: string;
  internal_role: InternalRole;
  commercial_id: string | null;
  hubspot_owner_id: string | null;
  name: string | null;
}

/**
 * Verify the request is from an authenticated internal sales user.
 * Returns either { auth: SalesAuthResult } on success or { error: NextResponse }
 * with the appropriate HTTP status code.
 *
 * Usage in an API route:
 *   const r = await verifySales(request);
 *   if ("error" in r) return r.error;
 *   const { auth } = r;
 *   // auth.commercial_id, auth.internal_role, etc.
 *
 * Pass `requireAdmin: true` to require sales_admin specifically (e.g. for
 * editing attributions).
 */
export async function verifySales(
  request: NextRequest,
  options: { requireAdmin?: boolean } = {},
): Promise<{ auth: SalesAuthResult } | { error: NextResponse }> {
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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const internalRole = meta?.internal_role as InternalRole | undefined;

  if (internalRole !== "sales" && internalRole !== "sales_admin") {
    return { error: NextResponse.json({ error: "Internal sales access required" }, { status: 403 }) };
  }

  if (options.requireAdmin && internalRole !== "sales_admin") {
    return { error: NextResponse.json({ error: "Sales admin access required" }, { status: 403 }) };
  }

  return {
    auth: {
      user_id: user.id,
      email: user.email || "",
      internal_role: internalRole,
      commercial_id: (meta?.commercial_id as string | undefined) || null,
      hubspot_owner_id: (meta?.hubspot_owner_id as string | undefined) || null,
      name: (meta?.name as string | undefined) || null,
    },
  };
}
