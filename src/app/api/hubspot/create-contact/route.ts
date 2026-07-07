import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HUBSPOT_BASE = "https://api.hubapi.com";

// HubSpot exige un téléphone au format E.164 (+33…). On normalise les numéros
// FR (0X… → +33X…) ; si on ne sait pas normaliser, on OMET le tél plutôt que
// de faire échouer toute la soumission (INVALID_PHONE_NUMBER).
function toE164(raw: string | undefined | null): string {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.length === 10 && d.startsWith("0")) return "+33" + d.slice(1);
  return ""; // format inconnu → on n'envoie pas à HubSpot
}

export async function POST(request: NextRequest) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_TOKEN is not configured" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { prenom, nom, email, tel, biens, comment, partnerUtm, partnerId } =
    body;

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  let contactResult = null;
  let referralResult = null;
  let hubspotWarning: string | null = null;

  const hsHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Step 1: Search for existing contact by email, then create or update
  try {
    const properties: Record<string, string> = {
      firstname: prenom || "",
      lastname: nom || "",
      email,
    };
    const phoneE164 = toE164(tel);
    if (phoneE164) properties.phone = phoneE164;

    if (partnerUtm) {
      properties.partenaire__lead_ = partnerUtm;
    }

    // Search for existing contact by email
    const searchRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: hsHeaders,
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        }],
      }),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.total > 0) {
        // Contact exists — update with partner UTM if not already set
        const existingId = searchData.results[0].id;
        const updateProps: Record<string, string> = {};
        if (partnerUtm && !searchData.results[0].properties?.partenaire__lead_) {
          updateProps.partenaire__lead_ = partnerUtm;
        }
        if (Object.keys(updateProps).length > 0) {
          await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/${existingId}`, {
            method: "PATCH",
            headers: hsHeaders,
            body: JSON.stringify({ properties: updateProps }),
          });
        }
        contactResult = searchData.results[0];
      }
    }

    // Create new contact only if not found
    if (!contactResult) {
      const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        // Non bloquant : on garde la trace mais on n'échoue PAS la soumission
        // (le contact sera quand même enregistré côté Qlower en step 2).
        hubspotWarning = `HubSpot ${res.status}: ${(await res.text()).slice(0, 200)}`;
      } else {
        contactResult = await res.json();
      }
    }
  } catch (err: unknown) {
    hubspotWarning = `HubSpot request failed: ${err instanceof Error ? err.message : "Unknown error"}`;
  }

  // Step 2: Insert referral row in Supabase
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase.from("referrals").insert({
      prenom: prenom || null,
      nom: nom || null,
      email,
      tel: tel || null,
      biens: biens || null,
      comment: comment || null,
      partner_id: partnerId || null,
      hs_contact_id: contactResult?.id || null,
    }).select().single();

    if (error) {
      throw new Error(error.message);
    }

    referralResult = data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Contact was created in HubSpot but Supabase failed — return partial success
    return NextResponse.json(
      {
        contact: contactResult,
        referral: null,
        warning: `Supabase insert failed: ${message}`,
      },
      { status: 207 }
    );
  }

  return NextResponse.json(
    {
      contact: contactResult,
      referral: referralResult,
      ...(hubspotWarning ? { hubspotWarning } : {}),
    },
    { status: 201 }
  );
}
