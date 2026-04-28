import { createServiceClient } from "@/lib/supabase-server";
import { randomBytes } from "crypto";

/**
 * Generates a setup-password token for a partner email.
 * Token is valid for 7 days, single use, and triggers a password set/reset flow
 * via /setup-password?token=...
 *
 * Unlike Supabase magic links, the token is only consumed at POST time, so email
 * scanners (Outlook Safe Links, Gmail) cannot accidentally invalidate it by pre-clicking.
 *
 * @returns the full URL with the token, or null if email is empty
 */
export async function generateSetupPasswordLink(email: string): Promise<string | null> {
  if (!email) return null;
  const supabase = createServiceClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("password_setup_tokens").insert({
    email: email.toLowerCase().trim(),
    token,
    expires_at: expiresAt,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";
  return `${siteUrl}/setup-password?token=${token}`;
}
