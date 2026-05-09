import "dotenv/config";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { makeScriptPool } from "./script-pool.mjs";
import { detectLegacySchemaWithoutJournal } from "./reconcile-legacy.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = makeScriptPool(databaseUrl, { max: 1 });

const db = drizzle(pool);
const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

console.log(`Applying migrations from ${migrationsFolder}`);

try {
  if (await detectLegacySchemaWithoutJournal(pool)) {
    throw new Error(
      "Legacy schema detected without Drizzle migration journal entries. Run `npm run db:reconcile:legacy` once, then rerun `npm run db:migrate:deploy`.",
    );
  }

  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully.");
} finally {
  await pool.end();
}
