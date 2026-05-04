import "dotenv/config";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const target = new URL(databaseUrl);
const dbName = target.pathname.replace(/^\//, "");
if (!dbName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";

const adminPool = new Pool({
  connectionString: adminUrl.toString(),
});

await adminPool.query(`CREATE DATABASE "${dbName}"`);
await adminPool.end();

console.log(`Database "${dbName}" created.`);
console.log("Run `npm run db:push` next to apply the PostgreSQL schema.");
