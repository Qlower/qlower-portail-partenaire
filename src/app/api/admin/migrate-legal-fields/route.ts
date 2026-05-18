// POST /api/admin/migrate-legal-fields
// Endpoint one-shot pour exécuter la migration 20260518_partner_legal_fields.sql
// directement depuis Vercel. Idempotent grâce à "ADD COLUMN IF NOT EXISTS".
//
// Pré-requis : l'une de ces env vars doit être configurée sur Vercel :
//   - POSTGRES_URL_NON_POOLING  (auto-set par l'intégration Vercel ↔ Supabase, recommandé pour le DDL)
//   - DATABASE_URL              (manuel, format postgres://user:pass@host:port/db)
//   - POSTGRES_URL              (fallback, pooler — DDL peut échouer en transaction)
//
// Utilisation :
//   curl -X POST https://partenaire.qlower.com/api/admin/migrate-legal-fields \
//        -H "cookie: <ta session admin>"
// ou simplement via le bouton dans /admin onglet Paramètres.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { Client } from "pg";

export const maxDuration = 30;

const MIGRATION_SQL = `
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS forme_juridique text,
  ADD COLUMN IF NOT EXISTS capital text,
  ADD COLUMN IF NOT EXISTS rcs text,
  ADD COLUMN IF NOT EXISTS contact_civilite text,
  ADD COLUMN IF NOT EXISTS contact_position text;

COMMENT ON COLUMN partners.forme_juridique IS 'Type de société (SAS, SARL...) pour le cartouche de contrat';
COMMENT ON COLUMN partners.capital IS 'Capital social, texte libre (ex: "10 000 €")';
COMMENT ON COLUMN partners.rcs IS 'Ville du RCS d''immatriculation';
COMMENT ON COLUMN partners.contact_civilite IS 'Civilité du signataire (M. ou Mme)';
COMMENT ON COLUMN partners.contact_position IS 'Fonction du signataire (Président, Gérant...)';
`;

function pickConnectionString(): { url: string; source: string } | null {
  const candidates: Array<[string | undefined, string]> = [
    [process.env.POSTGRES_URL_NON_POOLING, "POSTGRES_URL_NON_POOLING"],
    [process.env.DATABASE_URL, "DATABASE_URL"],
    [process.env.POSTGRES_URL, "POSTGRES_URL"],
  ];
  for (const [val, name] of candidates) {
    if (val && val.startsWith("postgres")) return { url: val, source: name };
  }
  return null;
}

async function runMigration() {
  const conn = pickConnectionString();
  if (!conn) {
    throw new Error(
      "Aucune variable d'environnement de connexion Postgres trouvée. " +
        "Configure POSTGRES_URL_NON_POOLING ou DATABASE_URL sur Vercel " +
        "(Supabase Dashboard → Project Settings → Database → Connection string).",
    );
  }

  const client = new Client({
    connectionString: conn.url,
    // Supabase requiert SSL en prod
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    // Vérifie d'abord quels champs existent déjà (pour reporting)
    const beforeRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='partners'
         AND column_name IN ('forme_juridique','capital','rcs','contact_civilite','contact_position')`,
    );
    const existingBefore = beforeRes.rows.map((r) => r.column_name);

    // Exécute le DDL
    await client.query(MIGRATION_SQL);

    // Re-vérifie après pour confirmer
    const afterRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='partners'
         AND column_name IN ('forme_juridique','capital','rcs','contact_civilite','contact_position')`,
    );
    const existingAfter = afterRes.rows.map((r) => r.column_name);

    return {
      ok: true,
      connection: conn.source,
      existingBefore,
      existingAfter,
      added: existingAfter.filter((c) => !existingBefore.includes(c)),
    };
  } finally {
    await client.end();
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  try {
    const result = await runMigration();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[migrate-legal-fields] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// GET = dry run (vérifie la présence des colonnes, n'exécute rien)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const conn = pickConnectionString();
  if (!conn) {
    return NextResponse.json(
      {
        ok: false,
        error: "POSTGRES_URL_NON_POOLING / DATABASE_URL / POSTGRES_URL absent des env vars.",
      },
      { status: 500 },
    );
  }

  const client = new Client({
    connectionString: conn.url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const res = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='partners'
         AND column_name IN ('forme_juridique','capital','rcs','contact_civilite','contact_position')`,
    );
    const existing = res.rows.map((r) => r.column_name);
    const missing = [
      "forme_juridique",
      "capital",
      "rcs",
      "contact_civilite",
      "contact_position",
    ].filter((c) => !existing.includes(c));
    return NextResponse.json({
      ok: true,
      connection: conn.source,
      existing,
      missing,
      migrationNeeded: missing.length > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
