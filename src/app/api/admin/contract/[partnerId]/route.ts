// GET /api/admin/contract/[partnerId]
// Renvoie le contrat HTML prêt à imprimer (Ctrl+P → Save as PDF côté navigateur).
// Phase 1 : pas de génération PDF serveur → léger, zéro dépendance, fonctionne
// out-of-the-box sur Vercel. Phase 2 si nécessaire : Puppeteer + Chromium.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { renderContractHtml } from "@/lib/contract-template";
import type { Partner } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { partnerId } = await params;
  if (!partnerId) {
    return NextResponse.json({ error: "partnerId required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: partner, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const html = renderContractHtml(partner as Partner);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Pas de cache : le contrat doit refléter l'état actuel du partenaire
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
