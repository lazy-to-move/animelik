import "dotenv/config";
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { makeScriptPool } from "./script-pool.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to reconcile legacy migrations");
}

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

function getJournalEntries(folder) {
  const journalPath = resolve(folder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

  return journal.entries.map((entry) => {
    const sqlPath = resolve(folder, `${entry.tag}.sql`);
    const sql = fs.readFileSync(sqlPath, "utf8");

    return {
      tag: entry.tag,
      when: entry.when,
      hash: crypto.createHash("sha256").update(sql).digest("hex"),
    };
  });
}

export async function detectLegacySchemaWithoutJournal(pool) {
  const journalTable = await pool.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`);

  if (!journalTable.rows[0]?.name) {
    const appTables = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('anime', 'episodes', 'users', 'categories', 'watchlist', 'reviews')
    `);

    return (appTables.rows[0]?.count ?? 0) > 0;
  }

  const journalRows = await pool.query(`SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations`);
  const migrationCount = journalRows.rows[0]?.count ?? 0;

  if (migrationCount > 0) {
    return false;
  }

  const appTables = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('anime', 'episodes', 'users', 'categories', 'watchlist', 'reviews')
  `);

  return (appTables.rows[0]?.count ?? 0) > 0;
}

async function ensureMigrationTable(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

async function reconcileLegacyJournal() {
  const pool = makeScriptPool(databaseUrl, { max: 1 });

  try {
    await ensureMigrationTable(pool);

    const needsReconcile = await detectLegacySchemaWithoutJournal(pool);

    if (!needsReconcile) {
      console.log("No legacy journal reconciliation needed.");
      return;
    }

    const entries = getJournalEntries(migrationsFolder);

    await pool.query("BEGIN");

    for (const entry of entries) {
      await pool.query(
        `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`,
        [entry.hash, entry.when],
      );
    }

    await pool.query("COMMIT");
    console.log(`Reconciled ${entries.length} migration journal entries for the legacy schema.`);
    console.log("You can now run `npm run db:migrate:deploy` safely.");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await reconcileLegacyJournal();
}
