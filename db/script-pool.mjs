import { Pool } from "pg";

function shouldUseSsl(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslMode === "disable") {
    return false;
  }

  return /render\.com$/i.test(url.hostname) || sslMode === "require";
}

export function makeScriptPool(connectionString, overrides = {}) {
  return new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
    ...overrides,
  });
}
