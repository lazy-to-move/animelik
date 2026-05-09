import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword, normalizeEmail } from "./api/lib/passwords.ts";
import { makeScriptPool } from "./db/script-pool.mjs";

const pool = makeScriptPool(process.env.DATABASE_URL ?? "");

const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "admin@synx.local");
const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!123456";
const name = process.env.ADMIN_NAME ?? "Site Admin";
const passwordHash = await hashPassword(password);
const existing = await pool.query(
  `SELECT "id" FROM "users" WHERE "email" = $1 LIMIT 1`,
  [email],
);

const result = existing.rows[0]
  ? await pool.query(
      `
        UPDATE "users"
        SET "name" = $2, "passwordHash" = $3, "role" = 'admin'
        WHERE "id" = $1
        RETURNING "id", "email", "role"
      `,
      [existing.rows[0].id, name, passwordHash],
    )
  : await pool.query(
      `
        INSERT INTO "users" ("unionId", "name", "email", "passwordHash", "role")
        VALUES ($1, $2, $3, $4, 'admin')
        RETURNING "id", "email", "role"
      `,
      [`local:${email}:${randomUUID()}`, name, email, passwordHash],
    );

console.log("Admin user ready:", result.rows[0]);
await pool.end();
