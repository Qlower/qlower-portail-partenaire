import { NextRequest, NextResponse } from "next/server";

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

  const { partnerName, utmValue } = body;

  if (!partnerName || !utmValue) {
    return NextResponse.json(
      { error: "partnerName and utmValue are required" },
      { status: 400 }
    );
  }

  const slugifiedValue = utmValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const errors = [];
  let propertyResult = null;
  let workflowResult = null;

  // Step 1: Add a new enum option to the partenaire__lead_ contact property
  try {
    // First, fetch the existing property to get current options
    const getRes = await fetch(
      `${HUBSPOT_BASE}/crm/v3/properties/contacts/partenaire__lead_`,
      { headers }
    );

    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(
        `Failed to fetch property: ${getRes.status} ${errBody}`
      );
    }

    const existingProperty = await getRes.json();
    const existingOptions = existingProperty.options || [];

    // Append the new option
    const updatedOptions = [
      ...existingOptions,
      {
        label: partnerName,
        value: slugifiedValue,
        hidden: false,
        displayOrder: existingOptions.length,
      },
    ];

    const patchRes = await fetch(
      `${HUBSPOT_BASE}/crm/v3/properties/contacts/partenaire__lead_`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ options: updatedOptions }),
      }
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      throw new Error(
        `Failed to patch property: ${patchRes.status} ${errBody}`
      );
    }

    propertyResult = await patchRes.json();
  } catch (err: unknown) {
    errors.push({ step: "property", message: err instanceof Error ? err.message : "Unknown error" });
  }

  // Step 2: Create a workflow that tags contacts when HubSpot captures
  // the UTM in `hs_analytics_source_data_2` (format "{utm_source} / {utm_medium}").
  // The previous trigger on a non-existent `utm_source` property never fired.
  try {
    const workflowPayload = {
      name: `Auto-tag partenaire: ${partnerName}`,
      type: "CONTACT",
      enabled: true,
      triggers: [
        {
          filterBranch: {
            filterBranchType: "AND",
            filters: [
              {
                property: "hs_analytics_source_data_2",
                operator: "STARTS_WITH",
                value: `${utmValue}/`,
              },
            ],
          },
        },
        {
          filterBranch: {
            filterBranchType: "AND",
            filters: [
              {
                property: "hs_analytics_source_data_2",
                operator: "STARTS_WITH",
                value: `${utmValue} /`,
              },
            ],
          },
        },
      ],
      actions: [
        {
          type: "SET_CONTACT_PROPERTY",
          propertyName: "partenaire__lead_",
          propertyValue: slugifiedValue,
        },
      ],
    };

    const wfRes = await fetch(`${HUBSPOT_BASE}/automation/v4/flows`, {
      method: "POST",
      headers,
      body: JSON.stringify(workflowPayload),
    });

    if (!wfRes.ok) {
      const errBody = await wfRes.text();
      throw new Error(
        `Failed to create workflow: ${wfRes.status} ${errBody}`
      );
    }

    workflowResult = await wfRes.json();
  } catch (err: unknown) {
    errors.push({ step: "workflow", message: err instanceof Error ? err.message : "Unknown error" });
  }

  const status = errors.length > 0 ? 207 : 200;

  return NextResponse.json(
    {
      property: propertyResult,
      workflow: workflowResult,
      errors,
    },
    { status }
  );
}
