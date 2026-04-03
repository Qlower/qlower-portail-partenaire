import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

const PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "partenaire__lead_",
  "hs_v2_date_entered_999998694",
  "hs_v2_date_exited_999998694",
  "lifecyclestage",
];

// GET /api/partner/commissions?partner_id=xxx&year=2026
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get partner UTM and commission rules
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("utm, comm_rules")
    .eq("id", partnerId)
    .single();

  if (partnerError || !partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  // Fetch all HubSpot contacts for this partner
  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            { propertyName: "partenaire__lead_", operator: "EQ", value: partner.utm },
          ],
        },
      ],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  // Process contacts: group subscribers by month/year
  const monthlyData: Record<number, { subscribers: string[]; count: number }> = {};
  // Initialize all 12 months
  for (let m = 1; m <= 12; m++) {
    monthlyData[m] = { subscribers: [], count: 0 };
  }

  let totalSubscribersCurrentYear = 0;
  let totalSubscribersPreviousYear = 0;
  const previousYearMonthly: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    previousYearMonthly[m] = 0;
  }

  for (const contact of contacts) {
    const dateStr = contact.properties.hs_v2_date_entered_999998694;
    if (!dateStr) continue; // Never entered subscriber stage

    // Check if currently subscriber OR entered and never exited
    const exitDateStr = contact.properties.hs_v2_date_exited_999998694;
    const currentLifecycle = (contact.properties.lifecyclestage || "").toLowerCase();
    const isCurrentlySubscriber = currentLifecycle === "999998694";

    // Count if: lifecycle IS currently subscriber, OR entered and never exited
    const enteredAndNeverExited = !exitDateStr;
    if (!isCurrentlySubscriber && !enteredAndNeverExited) continue; // Churned: exited and no longer subscriber

    const subDate = new Date(dateStr);
    const subYear = subDate.getFullYear();
    const subMonth = subDate.getMonth() + 1; // 1-indexed
    const name = [contact.properties.firstname, contact.properties.lastname]
      .filter(Boolean)
      .join(" ") || contact.properties.email || "Inconnu";

    if (subYear === year) {
      totalSubscribersCurrentYear++;
      monthlyData[subMonth].count++;
      monthlyData[subMonth].subscribers.push(name);
    } else if (subYear === year - 1) {
      totalSubscribersPreviousYear++;
      previousYearMonthly[subMonth]++;
    }
  }

  // Calculate commission based on partner's rules
  const annuelleRule = (partner.comm_rules || []).find(
    (r: { type: string; actif: boolean }) => r.type === "annuelle" && r.actif
  );
  const montantParAbonne = annuelleRule?.montant || 100;

  const months = [];
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      label: monthNames[m - 1],
      subscribers: monthlyData[m].count,
      commission: monthlyData[m].count * montantParAbonne,
      subscriberNames: monthlyData[m].subscribers,
      previousYear: previousYearMonthly[m],
      previousYearCommission: previousYearMonthly[m] * montantParAbonne,
    });
  }

  return NextResponse.json({
    year,
    partnerId,
    montantParAbonne,
    totalSubscribers: totalSubscribersCurrentYear,
    totalCommission: totalSubscribersCurrentYear * montantParAbonne,
    previousYear: {
      year: year - 1,
      totalSubscribers: totalSubscribersPreviousYear,
      totalCommission: totalSubscribersPreviousYear * montantParAbonne,
    },
    months,
    totalContacts: contacts.length,
  });
}
