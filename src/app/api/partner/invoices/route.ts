import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getResend, INTERNAL_FROM } from "@/lib/resend";

// Destinataires de l'alerte "nouvelle facture déposée".
const INVOICE_ALERT_TO = ["coline@qlower.com", "alexandre@qlower.com"];

// GET /api/partner/invoices?partner_id=X
// Returns all invoices for a partner (ordered by year desc)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partner_invoices")
    .select("*")
    .eq("partner_id", partnerId)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/partner/invoices
// Body: multipart/form-data with fields { partner_id, year, amount, file (PDF) }
// Creates or replaces the invoice for that year.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const partnerId = String(form.get("partner_id") || "");
  const year = parseInt(String(form.get("year") || "0"));
  const amount = parseFloat(String(form.get("amount") || "0"));
  const file = form.get("file") as File | null;

  if (!partnerId || !year || amount <= 0 || !file) {
    return NextResponse.json(
      { error: "partner_id, year, amount > 0 and file (PDF) are required" },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Upload PDF to Storage
  const ext = "pdf";
  const filename = `${partnerId}/${year}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("partner-invoices")
    .upload(filename, file, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Préserve le statut de paiement existant : (re)déposer un PDF ne doit JAMAIS
  // dépayer une facture déjà réglée (utile quand l'admin attache après coup le
  // PDF d'une année déjà soldée hors facture).
  const { data: existingInv } = await supabase
    .from("partner_invoices")
    .select("is_paid, paid_at")
    .eq("partner_id", partnerId)
    .eq("year", year)
    .maybeSingle();

  // Upsert invoice record
  const { data, error } = await supabase
    .from("partner_invoices")
    .upsert(
      {
        partner_id: partnerId,
        year,
        amount,
        file_url: filename,
        uploaded_at: new Date().toISOString(),
        is_paid: existingInv?.is_paid ?? false,
        paid_at: existingInv?.paid_at ?? null,
        historical: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner_id,year" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Alerte interne — sauf si c'est l'admin qui dépose lui-même (via=admin).
  // N'échoue jamais le dépôt si l'email part mal.
  const via = String(form.get("via") || "");
  if (via !== "admin") {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("nom, utm")
        .eq("id", partnerId)
        .maybeSingle();
      const nom = partner?.nom || partnerId;
      await getResend().emails.send({
        from: INTERNAL_FROM,
        to: INVOICE_ALERT_TO,
        subject: `🧾 Nouvelle facture déposée — ${nom} (${year})`,
        html: `<p>Le partenaire <strong>${nom}</strong> vient de déposer sa facture pour <strong>${year}</strong>.</p>
<ul>
  <li>Montant déclaré : <strong>${amount.toLocaleString("fr-FR")} €</strong></li>
  <li>Année : ${year}</li>
</ul>
<p>À vérifier puis marquer payée dans la <a href="https://partenaire.qlower.com/admin">tour de contrôle &rsaquo; Facturation</a>.</p>`,
      });
    } catch (e) {
      console.error("[invoices] notif dépôt échouée:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
