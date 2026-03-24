import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");

  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");

  sheet.columns = [
    { header: "Nom", key: "nom", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Source", key: "source", width: 12 },
    { header: "Statut", key: "stage", width: 15 },
    { header: "Biens", key: "biens", width: 8 },
    { header: "Mois", key: "mois", width: 12 },
    { header: "Date", key: "created_at", width: 20 },
  ];

  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4E92BD" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const lead of leads) {
    sheet.addRow({
      nom: lead.nom,
      email: lead.email,
      source: lead.source,
      stage: lead.stage,
      biens: lead.biens || 0,
      mois: lead.mois || "",
      created_at: new Date(lead.created_at).toLocaleDateString("fr-FR"),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads_${partnerId}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
