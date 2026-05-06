import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

type HSOption = {
  label: string;
  value: string;
  hidden?: boolean;
  displayOrder?: number;
};

export type SyncEnumReport = {
  totalPartners: number;
  activePartners: number;
  missingActiveCount: number;
  missingActive: Array<{ utm: string; nom: string }>;
  added: number;
  addedItems: Array<{ utm: string; nom: string }>;
  // Variants detected: an existing enum option uses a different separator
  // (e.g. partner has UTM "foo-bar" in Supabase but enum has "foo_bar").
  // We add the partner UTM as a NEW option so HubSpot accepts the PATCH from
  // the webhook (which writes the kebab UTM, not the snake variant).
  variantConflicts: Array<{ utm: string; existingValue: string }>;
};

// Normalize a UTM/value for variant comparison (kebab ↔ snake).
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, "-");
}

async function fetchEnumOptions(): Promise<HSOption[]> {
  const res = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch enum: ${res.status}`);
  const data = await res.json();
  return data.options || [];
}

async function patchEnumOptions(allOptions: HSOption[]): Promise<boolean> {
  const res = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ options: allOptions }),
  });
  return res.ok;
}

// Sync the HubSpot `partenaire__lead_` enum with active partners in Supabase.
// Idempotent: only appends missing options, never modifies/removes existing ones.
export async function syncHubspotEnum(apply: boolean): Promise<SyncEnumReport> {
  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("utm, nom, active");

  const allPartners = (partners || []).filter((p) => p.utm) as Array<{
    utm: string;
    nom: string;
    active: boolean | null;
  }>;
  const activePartners = allPartners.filter((p) => p.active);

  const enumOptions = await fetchEnumOptions();
  // Index by exact-lowercase value AND by normalized (kebab) value.
  // Webhook auto-tag PATCHes with the EXACT UTM string, so HubSpot must
  // have an option whose value === utm (case sensitive in some HubSpot
  // accounts). We also track variants for ops visibility.
  const enumValuesExact = new Set(enumOptions.map((o) => o.value.toLowerCase()));
  const enumValuesNormalized = new Map<string, string>(); // normalized -> existing exact value
  for (const o of enumOptions) enumValuesNormalized.set(normalize(o.value), o.value);

  const missingActive: Array<{ utm: string; nom: string }> = [];
  const variantConflicts: Array<{ utm: string; existingValue: string }> = [];

  for (const p of activePartners) {
    if (enumValuesExact.has(p.utm.toLowerCase())) continue; // exact match exists — fine
    const existingVariant = enumValuesNormalized.get(normalize(p.utm));
    if (existingVariant) {
      // Variant detected (e.g. partner UTM "foo-bar" but enum has "foo_bar").
      // We still need to ADD the partner UTM as a NEW option so the webhook
      // PATCH succeeds. HubSpot allows multiple options with similar values.
      variantConflicts.push({ utm: p.utm, existingValue: existingVariant });
    }
    missingActive.push({ utm: p.utm, nom: p.nom });
  }

  let added = 0;
  let addedItems: Array<{ utm: string; nom: string }> = [];

  if (apply && missingActive.length > 0) {
    const updatedOptions: HSOption[] = [
      ...enumOptions,
      ...missingActive.map((m, i) => ({
        label: m.nom,
        value: m.utm,
        hidden: false,
        displayOrder: enumOptions.length + i,
      })),
    ];
    const ok = await patchEnumOptions(updatedOptions);
    if (ok) {
      added = missingActive.length;
      addedItems = missingActive;
    }
  }

  return {
    totalPartners: allPartners.length,
    activePartners: activePartners.length,
    missingActiveCount: missingActive.length,
    missingActive,
    added,
    addedItems,
    variantConflicts,
  };
}
