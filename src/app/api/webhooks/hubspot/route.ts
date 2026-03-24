import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import crypto from "crypto";

const HS_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || "";
const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

// ── Verify HubSpot signature (v3) ───────────────────────────
function verifySignature(body: string, signature: string | null, url: string, method: string): boolean {
  if (!HS_CLIENT_SECRET || !signature) return !HS_CLIENT_SECRET; // skip if no secret configured
  const sourceString = HS_CLIENT_SECRET + method + url + body;
  const hash = crypto.createHash("sha256").update(sourceString).digest("hex");
  return hash === signature;
}

// ── Fetch full contact from HubSpot ─────────────────────────
async function fetchContact(contactId: string) {
  const res = await fetch(
    `${HS_BASE}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,partenaire__lead_,utm_source,hs_lifecyclestage`,
    { headers: { Authorization: `Bearer ${HS_TOKEN}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Map HubSpot lifecycle to our stage ──────────────────────
function mapStage(lifecycle: string | null): "Abonne" | "Payeur" | "Non payeur" {
  if (!lifecycle) return "Non payeur";
  const lc = lifecycle.toLowerCase();
  if (lc === "customer") return "Payeur";
  if (["subscriber", "lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"].includes(lc)) return "Abonne";
  return "Non payeur";
}

// ── POST handler ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify HubSpot signature if client secret is configured
  const signature = request.headers.get("x-hubspot-signature-v3");
  const url = request.url;
  if (!verifySignature(rawBody, signature, url, "POST")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: Array<{ contactId: string; status: string }> = [];

  for (const event of events) {
    const contactId = String(event.objectId || event.vid || "");
    if (!contactId) continue;

    // Fetch full contact data from HubSpot
    const contact = await fetchContact(contactId);
    if (!contact?.properties) {
      results.push({ contactId, status: "skip:no_data" });
      continue;
    }

    const props = contact.properties;
    const partnerUtm = props.partenaire__lead_ || props.utm_source || "";

    if (!partnerUtm) {
      results.push({ contactId, status: "skip:no_partner_utm" });
      continue;
    }

    // Find the partner by UTM
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("utm", partnerUtm)
      .single();

    if (!partner) {
      results.push({ contactId, status: `skip:partner_not_found(${partnerUtm})` });
      continue;
    }

    const nom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
    const email = props.email || "";
    const stage = mapStage(props.hs_lifecyclestage);

    // Check if lead already exists (avoid duplicates)
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("partner_id", partner.id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Update stage if changed
      await supabase
        .from("leads")
        .update({ stage, hs_contact_id: contactId })
        .eq("id", existing.id);
      results.push({ contactId, status: "updated" });
    } else {
      // Insert new lead
      const now = new Date();
      const mois = now.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });

      await supabase.from("leads").insert({
        partner_id: partner.id,
        nom,
        email,
        source: "UTM",
        stage,
        mois,
        biens: 0,
        hs_contact_id: contactId,
      });

      // Update partner lead count
      const { error: rpcError } = await supabase.rpc("increment_partner_leads", { p_id: partner.id });
      if (rpcError) {
        // Fallback: manual increment
        await supabase
          .from("partners")
          .update({ leads: 1 })
          .eq("id", partner.id);
      }

      // Log action
      await supabase.from("partner_actions").insert({
        partner_id: partner.id,
        type: "contact",
        label: `Nouveau lead UTM : ${nom} (${email})`,
        date: now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      });

      results.push({ contactId, status: "created" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
