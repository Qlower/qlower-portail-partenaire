// Récupère la "vraie origine" d'un contact depuis HubSpot :
//   - hs_analytics_source        → catégorie (ORGANIC_SEARCH, PAID_SEARCH, DIRECT_TRAFFIC…)
//   - hs_analytics_source_data_1 → détail (mot-clé, campagne, nom de la source)
//
// Utilisé par :
//   - le webhook Stripe (à l'ingestion d'une charge) pour stocker l'origine
//     sur attribution_rows.origin_source / origin_detail
//   - la route de backfill /api/admin/backfill-origin

const HS_TOKEN = process.env.HUBSPOT_TOKEN || "";
const HS_BASE = "https://api.hubapi.com";

// Mapping enum HubSpot → libellé FR lisible (rapport direction).
const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "Recherche organique (SEO)",
  PAID_SEARCH: "Recherche payante (Ads)",
  DIRECT_TRAFFIC: "Direct",
  REFERRALS: "Référent / lien",
  SOCIAL_MEDIA: "Réseaux sociaux",
  PAID_SOCIAL: "Réseaux sociaux (payant)",
  EMAIL_MARKETING: "Email",
  OFFLINE: "Offline / appel entrant",
  OTHER_CAMPAIGNS: "Autres campagnes",
  AI_REFERRALS: "Référent IA (ChatGPT…)",
};

/** Libellé FR lisible pour une valeur hs_analytics_source. */
export function prettyOrigin(source: string | null | undefined): string {
  if (!source) return "Inconnu";
  return SOURCE_LABELS[source] || source;
}

export interface HubspotOrigin {
  origin_source: string | null; // libellé FR
  origin_detail: string | null; // mot-clé / campagne brut
}

/**
 * Cherche le contact HubSpot par email et renvoie son origine analytique.
 * Best-effort : renvoie null si pas de token, pas de match, ou erreur réseau.
 */
export async function fetchOriginByEmail(email: string): Promise<HubspotOrigin | null> {
  if (!HS_TOKEN || !email) return null;
  try {
    const resp = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["hs_analytics_source", "hs_analytics_source_data_1"],
        limit: 1,
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      results?: Array<{ properties: Record<string, string | null> }>;
    };
    const props = data.results?.[0]?.properties;
    if (!props) return null;
    return {
      origin_source: prettyOrigin(props.hs_analytics_source),
      origin_detail: props.hs_analytics_source_data_1 || null,
    };
  } catch {
    return null;
  }
}
