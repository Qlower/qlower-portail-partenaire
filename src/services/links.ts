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
 *   https://www.qlower.com/qlower-x-partenaire?utm_source=<utm>&utm_medium=affiliation&utm_campaign=<utm>
 *
 * ⚠️ utm_campaign = l'UTM du partenaire (PAS le code). C'est l'`utm_campaign`
 * qui pilote le workflow HubSpot remplissant le menu `partenaire__lead_` : il
 * ne tague le contact que si la campaign correspond EXACTEMENT à une option du
 * menu — or les options du menu = les valeurs `utm` des partenaires. Mettre le
 * code (ex. "VAUVERT") laisserait le contact non tagué donc non attribué.
 * Le 2e paramètre est conservé pour compat. d'appel mais n'est plus utilisé.
 */
export const buildSignupLink = (utm: string, _code?: string | null): string => {
  const safeUtm = encodeURIComponent(utm || "");
  const base = `${SIGNUP_BASE}?utm_source=${safeUtm}&utm_medium=affiliation`;
  return utm ? `${base}&utm_campaign=${safeUtm}` : base;
};

export const buildRdvLink = (utm: string): string =>
  `${RDV_BASE}?utm_source=${encodeURIComponent(utm)}`;

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
