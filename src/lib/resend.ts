import { Resend } from "resend";

// Lazy initialization to avoid throwing at module load time when env var is missing (e.g. during build)
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Keep backward-compatible named export (only used at runtime in API routes)
export const resend = new Proxy({} as Resend, {
  get(_t, prop) {
    return (getResend() as unknown as Record<string, unknown>)[prop as string];
  },
});
// Adresse d'expédition par défaut. Coline étant le contact principal des
// partenaires/affiliés, on évite noreply@ ou partenaires@ (qui ne redirige
// nulle part) : si un partenaire répond, il atterrit direct chez Coline.
export const FROM = "Coline Sinquin <coline@qlower.com>";
