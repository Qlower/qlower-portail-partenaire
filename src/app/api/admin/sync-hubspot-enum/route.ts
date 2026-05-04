import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

export const maxDuration = 30;

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

type HSOption = {
  label: string;
  value: string;
  hidden?: boolean;
  displayOrder?: number;
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

type Diff = {
  utm: string;
  nom: string;
  active: boolean;
  inEnum: boolean;
};

async function buildDiff(): Promise<Diff[]> {
  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("utm, nom, active");

  if (!partners) return [];

  const enumOptions = await fetchEnumOptions();
  const enumValues = new Set(enumOptions.map((o) => o.value.toLowerCase()));

  return partners
    .filter((p) => p.utm)
    .map((p) => ({
      utm: p.utm as string,
      nom: p.nom as string,
      active: !!p.active,
      inEnum: enumValues.has((p.utm as string).toLowerCase()),
    }));
}

// GET — dry-run: list partners and tell which UTMs are missing in HubSpot enum
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  try {
    const diff = await buildDiff();
    const missing = diff.filter((d) => !d.inEnum && d.active);
    const inactiveMissing = diff.filter((d) => !d.inEnum && !d.active);
    return NextResponse.json({
      mode: "dry-run",
      totalPartners: diff.length,
      activePartners: diff.filter((d) => d.active).length,
      missingActiveCount: missing.length,
      missingActive: missing,
      inactiveMissing,
      allDiff: diff,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST — apply: append missing active UTMs to HubSpot enum
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  try {
    const diff = await buildDiff();
    const missing = diff.filter((d) => !d.inEnum && d.active);

    if (missing.length === 0) {
      return NextResponse.json({
        mode: "applied",
        added: 0,
        message: "Nothing to add — all active partners are already in the enum.",
      });
    }

    // Re-fetch to get the latest options (avoid stale state)
    const existing = await fetchEnumOptions();
    const updatedOptions: HSOption[] = [
      ...existing,
      ...missing.map((m, i) => ({
        label: m.nom,
        value: m.utm,
        hidden: false,
        displayOrder: existing.length + i,
      })),
    ];

    const ok = await patchEnumOptions(updatedOptions);
    if (!ok) {
      return NextResponse.json(
        { error: "PATCH partenaire__lead_ failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      mode: "applied",
      added: missing.length,
      addedItems: missing,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
