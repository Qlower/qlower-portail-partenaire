import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const maxDuration = 60;

// Temporary one-shot migration secret (will be removed after run).
// Set via Vercel env or hardcoded here for the single execution.
const MIGRATION_SECRET = "qlower-utm-fix-2026-04-27";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

// Mapping old (with spaces) → new (kebab-case) for the 8 partners with spaces
const RENAMES: Array<{ old: string; new: string }> = [
  { old: "Ante Meridiem", new: "ante-meridiem" },
  { old: "As Courtage", new: "as-courtage" },
  { old: "Cash Flow Positif", new: "cash-flow-positif" },
  { old: "Guest Ready", new: "guest-ready" },
  { old: "Hestia Conciergerie", new: "hestia-conciergerie" },
  { old: "Home to Home", new: "home-to-home" },
  { old: "Immobilier Sur Mesure", new: "immobilier-sur-mesure" },
  { old: "Meilleur Comptable", new: "meilleur-comptable" },
];

// POST /api/admin/migrate-utm-spaces
// 1. Updates HubSpot enum partenaire__lead_ : renames each old value → new
//    (this auto-updates all contacts using the renamed value)
// 2. Updates Supabase partners.utm
// 3. Updates Supabase leads (if utm/source columns track it — only partner_id matters here)
export async function POST(request: NextRequest) {
  // Migration token check (one-shot endpoint, removed after use)
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hsHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };

  // 1) Fetch the property to get current options
  const propRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    headers: hsHeaders,
  });
  if (!propRes.ok) {
    const text = await propRes.text();
    return NextResponse.json(
      { error: `Failed to read HubSpot property: ${text}` },
      { status: 500 }
    );
  }
  const propData = await propRes.json();
  const options = (propData.options || []) as Array<{
    label: string;
    value: string;
    hidden?: boolean;
    displayOrder?: number;
  }>;

  // 2) Rebuild the options array : rename matching values
  const renameMap = new Map(RENAMES.map((r) => [r.old, r.new]));
  const updatedOptions = options.map((opt) => {
    const newVal = renameMap.get(opt.value);
    if (newVal) {
      return { ...opt, value: newVal, label: opt.label }; // keep label readable
    }
    return opt;
  });

  // 3) PATCH the property to apply the rename (this re-tags all contacts atomically)
  const patchRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    method: "PATCH",
    headers: hsHeaders,
    body: JSON.stringify({ options: updatedOptions }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text();
    return NextResponse.json(
      { error: `Failed to PATCH HubSpot property: ${text}` },
      { status: 500 }
    );
  }

  // 4) Update Supabase partners.utm for each renamed partner
  const supabaseResults: Array<{ old: string; new: string; updated: number }> = [];
  for (const r of RENAMES) {
    const { data, error } = await supabase
      .from("partners")
      .update({ utm: r.new })
      .eq("utm", r.old)
      .select("id");
    if (error) {
      return NextResponse.json(
        { error: `Supabase update failed for ${r.old}: ${error.message}` },
        { status: 500 }
      );
    }
    supabaseResults.push({ old: r.old, new: r.new, updated: data?.length ?? 0 });
  }

  return NextResponse.json({
    ok: true,
    renamed: RENAMES.length,
    hubspotOptionsBefore: options.filter((o) => renameMap.has(o.value)).map((o) => o.value),
    supabase: supabaseResults,
  });
}
