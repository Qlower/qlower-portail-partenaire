// GET /api/admin/invoices/export?year=2024&partner_id=X&from=2024-01-01&to=2024-12-31
//
// Export XLS des factures partenaires + historique de paiement.
// Filtres (tous optionnels, combinables) :
//   - partner_id : une seule fiche partenaire
//   - year       : année de la facture
//   - from / to  : plage sur la DATE DE PAIEMENT (paid_at) — historique des règlements
// ADMIN-ONLY.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

export const maxDuration = 30;

function statusLabel(inv: {
  historical: boolean;
  is_paid: boolean;
  file_url: string | null;
}): string {
  if (inv.historical) return "Historique";
  if (inv.is_paid && inv.file_url) return "Payée";
  if (inv.is_paid && !inv.file_url) return "Soldé hors facture";
  if (inv.file_url && !inv.is_paid) return "À régler";
  return "En attente";
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const year = searchParams.get("year");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createServiceClient();

  let q = supabase
    .from("partner_invoices")
    .select("id, partner_id, year, amount, file_url, is_paid, historical, uploaded_at, paid_at, notes")
    .order("year", { ascending: false })
    .order("updated_at", { ascending: false });
  if (partnerId) q = q.eq("partner_id", partnerId);
  if (year) {
    const y = parseInt(year, 10);
    if (!isNaN(y)) q = q.eq("year", y);
  }
  // Plage de dates appliquée sur la date de paiement (historique des règlements).
  if (from) q = q.gte("paid_at", from);
  if (to) q = q.lte("paid_at", `${to}T23:59:59`);

  const { data: invoices, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Noms des partenaires
  const ids = [...new Set((invoices || []).map((i) => i.partner_id))];
  const nameById = new Map<string, { nom: string; code: string; email: string | null }>();
  if (ids.length > 0) {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, nom, code, email")
      .in("id", ids);
    for (const p of partners || []) nameById.set(p.id, { nom: p.nom, code: p.code, email: p.email });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Factures");
  sheet.columns = [
    { header: "Partenaire", key: "partenaire", width: 28 },
    { header: "Code", key: "code", width: 16 },
    { header: "Email", key: "email", width: 30 },
    { header: "Année", key: "annee", width: 8 },
    { header: "Montant (€)", key: "montant", width: 14 },
    { header: "Statut", key: "statut", width: 18 },
    { header: "Date dépôt", key: "depot", width: 14 },
    { header: "Date paiement", key: "paiement", width: 14 },
    { header: "Facture PDF", key: "pdf", width: 12 },
    { header: "Note", key: "note", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A3855" } };

  let totalPaid = 0;
  let totalDue = 0;
  for (const inv of invoices || []) {
    const p = nameById.get(inv.partner_id);
    const amount = Number(inv.amount) || 0;
    if (inv.is_paid) totalPaid += amount;
    else totalDue += amount;
    sheet.addRow({
      partenaire: p?.nom || inv.partner_id,
      code: p?.code || "",
      email: p?.email || "",
      annee: inv.year,
      montant: amount,
      statut: statusLabel(inv),
      depot: fmtDate(inv.uploaded_at),
      paiement: fmtDate(inv.paid_at),
      pdf: inv.file_url ? "Oui" : "Non",
      note: inv.notes || "",
    });
  }
  sheet.getColumn("montant").numFmt = "#,##0 €";

  // Ligne de totaux
  const totalRow = sheet.addRow({
    partenaire: "TOTAL",
    montant: totalPaid + totalDue,
    statut: `Payé ${Math.round(totalPaid).toLocaleString("fr-FR")} € · Dû ${Math.round(totalDue).toLocaleString("fr-FR")} €`,
  });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const tag = [year, partnerId ? "partenaire" : null, from || to ? "periode" : null]
    .filter(Boolean)
    .join("_") || "tout";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="factures_${tag}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
