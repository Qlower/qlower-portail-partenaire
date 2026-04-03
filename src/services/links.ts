const SIGNUP_BASE = "https://secure.qlower.com";
const RDV_BASE = "https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower";

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

export const buildSignupLink = (utm: string, code?: string | null): string => {
  const base = `${SIGNUP_BASE}/signup?utm_source=${utm}&utm_medium=affiliation`;
  return code ? `${base}&utm_campaign=${code}` : base;
};

export const buildRdvLink = (utm: string): string =>
  `${RDV_BASE}?utm_source=${utm}`;

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
