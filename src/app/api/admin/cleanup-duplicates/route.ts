import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// POST /api/admin/cleanup-duplicates
// Finds duplicate partners (same UTM) and keeps only the one with the most leads/data.
// Moves leads from the duplicate to the kept partner, then deletes the duplicate.
export async function POST() {
  const supabase = createServiceClient();

  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, nom, utm, code, email, leads, abonnes, created_at")
    .order("created_at", { ascending: true });

  if (error || !partners) {
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
  }

  // Group by UTM (case-insensitive)
  const byUtm = new Map<string, typeof partners>();
  for (const p of partners) {
    const key = (p.utm || "").toLowerCase();
    if (!key) continue;
    const group = byUtm.get(key) || [];
    group.push(p);
    byUtm.set(key, group);
  }

  const results: Array<{ utm: string; kept: string; deleted: string[]; leadsMoved: number }> = [];

  for (const [utm, group] of byUtm) {
    if (group.length <= 1) continue; // No duplicate

    // Keep the partner with the most data (leads count), or the oldest (first created)
    const sorted = group.sort((a, b) => {
      // Prefer the one with code promo set
      if (a.code && !b.code) return -1;
      if (!a.code && b.code) return 1;
      // Prefer the one with more leads
      if (a.leads !== b.leads) return b.leads - a.leads;
      // Prefer older
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keep = sorted[0];
    const duplicates = sorted.slice(1);

    let totalLeadsMoved = 0;

    for (const dup of duplicates) {
      // Move leads from duplicate to kept partner
      const { data: dupLeads } = await supabase
        .from("leads")
        .select("id, email")
        .eq("partner_id", dup.id);

      if (dupLeads && dupLeads.length > 0) {
        for (const lead of dupLeads) {
          // Check if lead already exists on kept partner
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("partner_id", keep.id)
            .eq("email", lead.email)
            .maybeSingle();

          if (existing) {
            // Delete duplicate lead
            await supabase.from("leads").delete().eq("id", lead.id);
          } else {
            // Move lead to kept partner
            await supabase
              .from("leads")
              .update({ partner_id: keep.id })
              .eq("id", lead.id);
            totalLeadsMoved++;
          }
        }
      }

      // Move partner_actions
      await supabase
        .from("partner_actions")
        .update({ partner_id: keep.id })
        .eq("partner_id", dup.id);

      // Update auth user metadata if the duplicate has a user_id
      // (point them to the kept partner)
      // Delete the duplicate partner
      await supabase.from("partners").delete().eq("id", dup.id);
    }

    // Update kept partner's lead/abonnes counts
    const { count: leadCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", keep.id);

    const { count: abonnesCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", keep.id)
      .eq("stage", "Abonne");

    await supabase
      .from("partners")
      .update({ leads: leadCount || 0, abonnes: abonnesCount || 0 })
      .eq("id", keep.id);

    results.push({
      utm,
      kept: `${keep.nom} (${keep.id})`,
      deleted: duplicates.map((d) => `${d.nom} (${d.id})`),
      leadsMoved: totalLeadsMoved,
    });
  }

  return NextResponse.json({
    message: `Cleaned ${results.length} duplicate group(s)`,
    results,
  });
}
