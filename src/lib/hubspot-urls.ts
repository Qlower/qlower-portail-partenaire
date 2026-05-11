// URLs de la console HubSpot Qlower.
//
// HubSpot URLs : https://app-eu1.hubspot.com/contacts/{portalId}/record/0-1/{contactId}
// Le portalId est numérique (26202579 pour Qlower), pas un alias texte.
//
// Récupéré une fois via l'API /account-info/v3/details (28 fév 2026).

export const HUBSPOT_PORTAL_ID = "26202579";
export const HUBSPOT_BASE = "https://app-eu1.hubspot.com";

/** URL d'une fiche contact HubSpot. */
export function hubspotContactUrl(contactId: string): string {
  return `${HUBSPOT_BASE}/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`;
}

/** URL de la liste des contacts HubSpot. */
export function hubspotContactsListUrl(): string {
  return `${HUBSPOT_BASE}/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all`;
}
