import "dotenv/config";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
});

const db = drizzle(pool);
const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

console.log(`Applying migrations from ${migrationsFolder}`);

try {
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully.");
} finally {
  await pool.end();
}
