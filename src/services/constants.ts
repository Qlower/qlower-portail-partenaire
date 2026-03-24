import type { PartnerType } from "@/types";

export const BENCHMARK: Record<string, { taux: number; label: string }> = {
  "agence-immo": { taux: 18, label: "agences immobilières" },
  cgp: { taux: 24, label: "CGP" },
  conciergerie: { taux: 21, label: "conciergeries" },
  default: { taux: 19, label: "partenaires similaires" },
};

export const METIERS = [
  "Agent immobilier",
  "CGP",
  "Expert-comptable",
  "Syndic",
  "Conciergerie",
  "Courtier",
  "Autre",
] as const;

export const PARTNER_TYPES: PartnerType[] = [
  "cgp", "agence-immo", "apporteur", "courtier", "conciergerie", "influenceur", "autre",
];

export const STAGE_STYLES: Record<string, { text: string; bg: string }> = {
  Abonne: { text: "text-green-800", bg: "bg-green-100" },
  Payeur: { text: "text-amber-800", bg: "bg-amber-100" },
  "Non payeur": { text: "text-gray-700", bg: "bg-gray-100" },
};

export const SOURCE_STYLES: Record<string, { text: string; bg: string }> = {
  UTM: { text: "text-blue-800", bg: "bg-blue-100" },
  Manuel: { text: "text-purple-800", bg: "bg-purple-100" },
  Promo: { text: "text-amber-800", bg: "bg-amber-100" },
};
