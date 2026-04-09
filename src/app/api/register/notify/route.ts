import { NextRequest, NextResponse } from "next/server";

// POST — notify Coline + send welcome email to partner
// TEMP: emails paused for testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[register/notify] Emails paused. Would send for:", body.partnerName, body.partnerEmail);
    return NextResponse.json({ ok: true, paused: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
