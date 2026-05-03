import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function createDb() {
  const pool = mysql.createPool({
    uri: env.databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
  });

  return drizzle(pool, {
    mode: "default",
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
