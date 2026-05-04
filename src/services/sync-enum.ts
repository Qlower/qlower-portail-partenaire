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
};

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
  const enumValues = new Set(enumOptions.map((o) => o.value.toLowerCase()));

  const missingActive = activePartners
    .filter((p) => !enumValues.has(p.utm.toLowerCase()))
    .map((p) => ({ utm: p.utm, nom: p.nom }));

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
  };
}
