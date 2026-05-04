import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword, normalizeEmail } from "./api/lib/passwords.ts";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "admin@synx.local");
const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!123456";
const name = process.env.ADMIN_NAME ?? "Site Admin";
const unionId = `local:${email}:${randomUUID()}`;
const passwordHash = await hashPassword(password);

const result = await pool.query(
  `
    INSERT INTO "users" ("unionId", "name", "email", "passwordHash", "role")
    VALUES ($1, $2, $3, $4, 'admin')
    ON CONFLICT ("email")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "passwordHash" = EXCLUDED."passwordHash",
      "role" = 'admin'
    RETURNING "id", "email", "role"
  `,
  [unionId, name, email, passwordHash],
);

console.log("Admin user ready:", result.rows[0]);
await pool.end();
