import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// Returns the SQL to run manually in Supabase SQL Editor to add hs_deleted columns.
// (Supabase does not allow ad-hoc DDL via the REST API.)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const sql = `ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS hs_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hs_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_hs_deleted ON leads(hs_deleted) WHERE hs_deleted = true;`;

  return NextResponse.json({
    sql,
    instructions:
      "Copy the SQL above and run it once in Supabase → SQL Editor. Safe to re-run.",
  });
}
