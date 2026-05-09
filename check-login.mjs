import "dotenv/config";
import * as jose from "jose";
import { makeScriptPool } from "./db/script-pool.mjs";

const pool = makeScriptPool(process.env.DATABASE_URL ?? "");

const unionId = process.env.DEV_UNION_ID ?? "dev-user";
const email = process.env.DEV_EMAIL ?? "dev@localhost";
const name = process.env.DEV_NAME ?? "Dev Admin";

const existing = await pool.query(
  `SELECT "id", "unionId", "email", "role" FROM "users" WHERE "unionId" = $1 LIMIT 1`,
  [unionId],
);

let user = existing.rows[0];

if (!user) {
  const inserted = await pool.query(
    `
      INSERT INTO "users" ("unionId", "name", "email", "role")
      VALUES ($1, $2, $3, 'admin')
      RETURNING "id", "unionId", "email", "role"
    `,
    [unionId, name, email],
  );
  user = inserted.rows[0];
  console.log("Created dev user");
}

const secret = new TextEncoder().encode(process.env.DEV_SESSION_SECRET ?? "dev-secret-key-min-32-chars-long-here");
const token = await new jose.SignJWT({ sub: String(user.id), role: user.role, unionId: user.unionId })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(secret);

console.log("User:", user);
console.log(`Use this cookie: session=${token}`);

await pool.end();
