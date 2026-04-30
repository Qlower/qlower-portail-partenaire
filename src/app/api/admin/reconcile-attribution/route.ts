import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { reconcileAttribution } from "@/services/reconcile";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  const result = await reconcileAttribution(false);
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  const result = await reconcileAttribution(true);
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
