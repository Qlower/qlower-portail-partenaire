import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const MIGRATION_SECRET = "qlower-utm-fix-2026-04-27";
const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

const RENAMES: Array<{ old: string; new: string; label: string }> = [
  { old: "Ante Meridiem", new: "ante-meridiem", label: "Ante Meridiem" },
  { old: "As Courtage", new: "as-courtage", label: "As Courtage" },
  { old: "Cash Flow Positif", new: "cash-flow-positif", label: "Cash Flow Positif" },
  { old: "Guest Ready", new: "guest-ready", label: "Guest Ready" },
  { old: "Hestia Conciergerie", new: "hestia-conciergerie", label: "Hestia Conciergerie" },
  { old: "Home to Home", new: "home-to-home", label: "Home to Home" },
  { old: "Immobilier Sur Mesure", new: "immobilier-sur-mesure", label: "Immobilier Sur Mesure" },
  { old: "Meilleur Comptable", new: "meilleur-comptable", label: "Meilleur Comptable" },
];

// POST /api/admin/migrate-utm-spaces?token=...
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hsHeaders = { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" };

  // 1) Get current enum options
  const propRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    headers: hsHeaders,
  });
  if (!propRes.ok) {
    return NextResponse.json(
      { error: `Failed to read property: ${await propRes.text()}` },
      { status: 500 }
    );
  }
  const propData = await propRes.json();
  type Opt = { label: string; value: string; hidden?: boolean; displayOrder?: number };
  const currentOptions: Opt[] = propData.options || [];
  const existing = new Set(currentOptions.map((o) => o.value));

  // 2) Ensure both old AND new values exist in the enum (so we can update contacts)
  const needed: Opt[] = [...currentOptions];
  for (const r of RENAMES) {
    if (!existing.has(r.old)) {
      needed.push({ label: r.label, value: r.old, hidden: true, displayOrder: -1 });
    }
    if (!existing.has(r.new)) {
      needed.push({ label: r.label, value: r.new, hidden: false, displayOrder: -1 });
    }
  }

  const ensureRes = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    method: "PATCH",
    headers: hsHeaders,
    body: JSON.stringify({ options: needed }),
  });
  if (!ensureRes.ok) {
    return NextResponse.json(
      { error: `Failed to PATCH property: ${await ensureRes.text()}` },
      { status: 500 }
    );
  }

  // 3) For each old value, find ALL contacts and update them to the new value
  const report: Array<{ old: string; new: string; updated: number }> = [];
  for (const r of RENAMES) {
    let updatedCount = 0;
    let after: string | undefined;
    do {
      const searchBody: Record<string, unknown> = {
        filterGroups: [{ filters: [{ propertyName: "partenaire__lead_", operator: "EQ", value: r.old }] }],
        properties: ["partenaire__lead_"],
        limit: 100,
        ...(after ? { after } : {}),
      };
      const searchRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify(searchBody),
      });
      if (!searchRes.ok) break;
      const searchData = await searchRes.json();
      const ids = (searchData.results || []).map((c: { id: string }) => c.id);

      // Batch update by 100
      if (ids.length > 0) {
        const batchRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/batch/update`, {
          method: "POST",
          headers: hsHeaders,
          body: JSON.stringify({
            inputs: ids.map((id: string) => ({
              id,
              properties: { partenaire__lead_: r.new },
            })),
          }),
        });
        if (batchRes.ok) updatedCount += ids.length;
      }
      after = searchData.paging?.next?.after;
    } while (after);

    report.push({ old: r.old, new: r.new, updated: updatedCount });
  }

  // 4) Update Supabase partners.utm
  const supabaseResults: Array<{ old: string; new: string; updated: number }> = [];
  for (const r of RENAMES) {
    const { data } = await supabase
      .from("partners")
      .update({ utm: r.new })
      .eq("utm", r.old)
      .select("id");
    supabaseResults.push({ old: r.old, new: r.new, updated: data?.length ?? 0 });
  }

  return NextResponse.json({
    ok: true,
    hubspotContacts: report,
    supabasePartners: supabaseResults,
  });
}
