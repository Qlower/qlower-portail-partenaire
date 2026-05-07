const SIGNUP_BASE = "https://secure.qlower.com/signup";
const RDV_BASE = "https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower";

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/**
 * Lien d'inscription Qlower tracké pour un partenaire donné.
 *
 *   https://secure.qlower.com/signup?utm_source=<utm>&utm_medium=affiliation&utm_campaign=<code>
 *
 * Note : on a tenté brièvement de pointer sur https://qlower.com/partenaire/<utm>
 * (page partenaire-brandée), mais ces routes ne sont pas implémentées sur
 * le site marketing → 404. On reste donc sur secure.qlower.com/signup, qui
 * est le formulaire d'inscription B2C effectif. Les UTMs sont conservés
 * en query-string pour que HubSpot capture l'attribution dans
 * hs_analytics_source_data_2 → trigger l'auto-tag du webhook.
 */
export const buildSignupLink = (utm: string, code?: string | null): string => {
  const safeUtm = encodeURIComponent(utm || "");
  const base = `${SIGNUP_BASE}?utm_source=${safeUtm}&utm_medium=affiliation`;
  return code ? `${base}&utm_campaign=${encodeURIComponent(code)}` : base;
};

export const buildRdvLink = (utm: string): string =>
  `${RDV_BASE}?utm_source=${encodeURIComponent(utm)}`;

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
