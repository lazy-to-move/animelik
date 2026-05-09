import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return databaseUrl;
}

function createDb() {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  });

  return drizzle(pool, {
    schema: fullSchema,
  });
}

type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

export function getDb(): Db {
  if (!instance) {
    instance = createDb();
  }

  return instance;
}
