import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

function mapStage(lifecycle: string | null): "Abonne" | "Payeur" | "Non payeur" {
  if (!lifecycle) return "Non payeur";
  const lc = lifecycle.toLowerCase();
  if (lc === "customer") return "Payeur";
  if (["subscriber", "lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"].includes(lc)) return "Abonne";
  return "Non payeur";
}

// Called when a contact's lifecycle stage changes in HubSpot
export async function POST(request: NextRequest) {
  const events = await request.json();
  const items = Array.isArray(events) ? events : [events];
  const supabase = createServiceClient();
  let updated = 0;

  for (const event of items) {
    const contactId = String(event.objectId || "");
    if (!contactId) continue;

    // Fetch contact to get new lifecycle + partner UTM
    const res = await fetch(
      `${HS_BASE}/crm/v3/objects/contacts/${contactId}?properties=email,partenaire__lead_,hs_lifecyclestage`,
      { headers: { Authorization: `Bearer ${HS_TOKEN}` } }
    );
    if (!res.ok) continue;
    const contact = await res.json();
    const email = contact.properties?.email;
    const newStage = mapStage(contact.properties?.hs_lifecyclestage);

    if (!email) continue;

    // Update lead stage in our DB
    const { error } = await supabase
      .from("leads")
      .update({ stage: newStage })
      .eq("email", email)
      .eq("hs_contact_id", contactId);

    if (!error) updated++;
  }

  return NextResponse.json({ updated });
}
