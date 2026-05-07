const SIGNUP_BASE = "https://www.qlower.com/qlower-x-partenaire";
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
 *   https://www.qlower.com/qlower-x-partenaire?utm_source=<utm>&utm_medium=affiliation&utm_campaign=<code>
 *
 * Page d'atterrissage commune côté site marketing — les UTMs en query-string
 * sont capturés par HubSpot dans hs_analytics_source_data_2 → enables the
 * auto-tag du webhook contact (lead-to-partner attribution).
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
