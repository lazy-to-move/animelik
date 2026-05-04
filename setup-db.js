require("dotenv/config");

const { Pool } = require("pg");

async function setup() {
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

  const pool = new Pool({
    connectionString: adminUrl.toString(),
  });

  await pool.query(`CREATE DATABASE "${dbName}"`);
  await pool.end();

  console.log(`Database "${dbName}" created.`);
  console.log("Run `npm run db:push` next to apply the PostgreSQL schema.");
}

setup().catch((error) => {
  console.error(error);
  process.exit(1);
});
