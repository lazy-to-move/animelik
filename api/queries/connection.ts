import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function createDb() {
  const pool = new Pool({
    connectionString: env.databaseUrl,
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
