const PARTNER_PAGE_BASE = "https://qlower.com/partenaire";
const RDV_BASE = "https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower";

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/**
 * Returns the public partner-branded landing page URL.
 *
 *   https://qlower.com/partenaire/<utm>?utm_source=<utm>&utm_medium=affiliation&utm_campaign=<code>
 *
 * The path-part `<utm>` lets qlower.com render the partner-branded landing.
 * The query-string UTMs are kept so HubSpot's analytics tracking captures
 * them in `hs_analytics_source_data_2` → enables the auto-tag in the
 * webhook (lead-to-partner attribution).
 */
export const buildSignupLink = (utm: string, code?: string | null): string => {
  const safeUtm = encodeURIComponent(utm || "");
  const base = `${PARTNER_PAGE_BASE}/${safeUtm}?utm_source=${safeUtm}&utm_medium=affiliation`;
  return code ? `${base}&utm_campaign=${encodeURIComponent(code)}` : base;
};

export const buildRdvLink = (utm: string): string =>
  `${RDV_BASE}?utm_source=${encodeURIComponent(utm)}`;

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
