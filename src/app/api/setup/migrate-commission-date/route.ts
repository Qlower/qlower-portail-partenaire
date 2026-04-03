import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// One-time migration: add commission_date column to leads table
// DELETE THIS FILE AFTER USE
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.secret !== "qlower-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Check if column already exists by trying to query it
  const { error: checkError } = await supabase
    .from("leads")
    .select("commission_date")
    .limit(1);

  if (!checkError) {
    return NextResponse.json({ message: "Column commission_date already exists", status: "ok" });
  }

  // Try to add column via Supabase Management API (SQL execution)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }

  // Extract project ref from URL (e.g., https://abcdef.supabase.co -> abcdef)
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

  // Try multiple SQL execution methods
  const sql = "ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS commission_date timestamptz;";

  // Method 1: Supabase SQL API
  const endpoints = [
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    `https://${projectRef}.supabase.co/pg/query`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql, sql }),
      });

      if (res.ok) {
        return NextResponse.json({ message: "Migration successful via API", status: "ok" });
      }
    } catch {
      // Try next method
    }
  }

  return NextResponse.json({
    error: "Automatic migration failed - SQL execution not available via API",
    manual_sql: sql,
    hint: "Go to supabase.com/dashboard > SQL Editor and run the SQL above",
  }, { status: 500 });
}
