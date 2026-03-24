import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HUBSPOT_BASE = "https://api.hubapi.com";

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

  // Step 1: Create contact in HubSpot
  try {
    const properties: Record<string, string> = {
      firstname: prenom || "",
      lastname: nom || "",
      email,
      phone: tel || "",
    };

    if (partnerUtm) {
      properties.partenaire__lead_ = partnerUtm;
    }

    const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: `HubSpot error: ${res.status} ${errBody}` },
        { status: res.status >= 400 && res.status < 500 ? res.status : 502 }
      );
    }

    contactResult = await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `HubSpot request failed: ${message}` },
      { status: 502 }
    );
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
      partner_utm: partnerUtm || null,
      partner_id: partnerId || null,
      hubspot_contact_id: contactResult?.id || null,
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
    },
    { status: 201 }
  );
}
