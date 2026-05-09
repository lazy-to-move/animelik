import "dotenv/config";
import { Pool } from "pg";

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
const copyMode = (process.env.COPY_MODE ?? "content").toLowerCase();

if (!sourceUrl) {
  throw new Error("DATABASE_URL is required for the source database.");
}

if (!targetUrl) {
  throw new Error("TARGET_DATABASE_URL is required for the target database.");
}

const TABLE_GROUPS = {
  content: ["categories", "anime", "animeGenres", "episodes"],
  full: [
    "users",
    "categories",
    "anime",
    "animeGenres",
    "episodes",
    "watchlist",
    "reviews",
    "episodeBrokenReports",
  ],
};

const tables = TABLE_GROUPS[copyMode];

if (!tables) {
  throw new Error(`Unsupported COPY_MODE "${copyMode}". Use "content" or "full".`);
}

function makePool(connectionString) {
  const url = new URL(connectionString);
  const useSsl = /render\.com$/i.test(url.hostname) || /render\.com$/i.test(url.host);

  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function qualifiedTableName(table) {
  return `public.${quoteIdentifier(table)}`;
}

function chunk(values, size) {
  const items = [];
  for (let index = 0; index < values.length; index += size) {
    items.push(values.slice(index, index + size));
  }
  return items;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

async function resetSequence(client, table) {
  const tableName = qualifiedTableName(table);
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('${tableName}', 'id'),
      COALESCE((SELECT MAX("id") FROM ${tableName}), 1),
      EXISTS(SELECT 1 FROM ${tableName})
    );
  `);
}

async function copyTable(source, target, table) {
  const tableName = qualifiedTableName(table);
  const { rows, fields } = await source.query(`SELECT * FROM ${tableName} ORDER BY "id" ASC`);

  if (rows.length === 0) {
    console.log(`Skipped ${table}: no rows to copy.`);
    return 0;
  }

  const columns = fields.map((field) => field.name);
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const rowChunks = chunk(rows, 200);

  for (const rowChunk of rowChunks) {
    const values = [];
    const tuples = rowChunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(normalizeValue(row[column]));
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    await target.query(`INSERT INTO ${tableName} (${quotedColumns}) VALUES ${tuples.join(", ")}`, values);
  }

  if (columns.includes("id")) {
    await resetSequence(target, table);
  }

  console.log(`Copied ${rows.length} rows into ${table}.`);
  return rows.length;
}

const source = makePool(sourceUrl);
const target = makePool(targetUrl);

try {
  await target.query("BEGIN");

  const truncateOrder = [...tables].reverse().map(qualifiedTableName).join(", ");
  await target.query(`TRUNCATE TABLE ${truncateOrder} RESTART IDENTITY CASCADE`);

  let totalRows = 0;
  for (const table of tables) {
    totalRows += await copyTable(source, target, table);
  }

  await target.query("COMMIT");
  console.log(`Copy complete. Total rows copied: ${totalRows}. Mode: ${copyMode}.`);
} catch (error) {
  await target.query("ROLLBACK").catch(() => {});
  console.error("Copy failed:", error);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
