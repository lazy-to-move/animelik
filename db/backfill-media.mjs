import "dotenv/config";
import fs from "fs";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { makeScriptPool } from "./script-pool.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to backfill media.");
}

const dryRun =
  process.argv.includes("--dry-run") ||
  (process.env.MEDIA_BACKFILL_DRY_RUN ?? "").trim().toLowerCase() === "true";
const limit = Number.parseInt(process.env.MEDIA_BACKFILL_LIMIT ?? "", 10);

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function getBundledAnimeCoversDir() {
  return path.resolve(process.cwd(), "public", "anime-covers");
}

function getImportedAnimeCoversDir() {
  return path.resolve(
    process.env.IMPORTED_MEDIA_DIR || getBundledAnimeCoversDir(),
  );
}

function toSafeResolvedPath(root, relativePath) {
  const normalized = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, normalized);

  if (
    candidate !== resolvedRoot &&
    !candidate.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    return null;
  }

  return candidate;
}

function findAnimeCoverFile(requestPath) {
  const decodedPath = decodeURIComponent(requestPath).replace(/^\/+/, "");
  if (!decodedPath) return null;

  const importedDir = getImportedAnimeCoversDir();
  const bundledDir = getBundledAnimeCoversDir();
  const roots =
    importedDir === bundledDir ? [importedDir] : [importedDir, bundledDir];

  for (const root of roots) {
    const candidate = toSafeResolvedPath(root, decodedPath);
    if (!candidate) continue;
    if (!fs.existsSync(candidate)) continue;
    if (fs.statSync(candidate).isFile()) return candidate;
  }

  return null;
}

function getContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function mapObjectStorageSource(currentSource) {
  switch (currentSource) {
    case "source_disk":
      return "source_object_storage";
    case "metadata_disk":
      return "metadata_object_storage";
    case "legacy_disk":
      return "legacy_object_storage";
    case "source_object_storage":
    case "metadata_object_storage":
    case "legacy_object_storage":
      return currentSource;
    default:
      return "legacy_object_storage";
  }
}

function getMediaPublicBaseUrl() {
  return trimSlashes(process.env.MEDIA_PUBLIC_BASE_URL ?? "");
}

function getS3Config() {
  return {
    bucket: process.env.S3_MEDIA_BUCKET?.trim() ?? "",
    region: process.env.S3_MEDIA_REGION?.trim() ?? "",
    endpoint: process.env.S3_MEDIA_ENDPOINT?.trim() || undefined,
    accessKeyId: process.env.S3_MEDIA_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: process.env.S3_MEDIA_SECRET_ACCESS_KEY?.trim() ?? "",
    forcePathStyle:
      (process.env.S3_MEDIA_FORCE_PATH_STYLE ?? "").trim().toLowerCase() ===
      "true",
  };
}

function validateS3Config() {
  const config = getS3Config();
  const missing = [
    !config.bucket && "S3_MEDIA_BUCKET",
    !config.region && "S3_MEDIA_REGION",
    !config.accessKeyId && "S3_MEDIA_ACCESS_KEY_ID",
    !config.secretAccessKey && "S3_MEDIA_SECRET_ACCESS_KEY",
    !getMediaPublicBaseUrl() && "MEDIA_PUBLIC_BASE_URL",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Backfill requires object storage configuration. Missing: ${missing.join(", ")}`,
    );
  }

  return config;
}

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    const config = validateS3Config();
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3Client;
}

function buildStorageKeyFromUrl(localUrl) {
  return trimSlashes(localUrl.replace(/^\/anime-covers\/+/i, "anime-covers/"));
}

function buildPublicUrl(storageKey) {
  const baseUrl = getMediaPublicBaseUrl();
  if (!baseUrl) {
    return `s3://<configured-bucket>/${storageKey}`;
  }

  return `${baseUrl}/${storageKey}`;
}

async function uploadFile(localUrl, cache) {
  if (cache.has(localUrl)) {
    return cache.get(localUrl);
  }

  const relativePath = localUrl.replace(/^\/anime-covers\/+/i, "");
  const localFile = findAnimeCoverFile(relativePath);
  if (!localFile) {
    cache.set(localUrl, null);
    return null;
  }

  const storageKey = buildStorageKeyFromUrl(localUrl);
  const publicUrl = buildPublicUrl(storageKey);

  if (!dryRun) {
    const config = validateS3Config();
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: fs.readFileSync(localFile),
        ContentType: getContentType(localFile),
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  const result = {
    localFile,
    storageKey,
    publicUrl,
  };

  cache.set(localUrl, result);
  return result;
}

function isLocalImportedAsset(url) {
  return typeof url === "string" && url.startsWith("/anime-covers/");
}

const pool = makeScriptPool(databaseUrl, { max: 1 });

async function main() {
  const whereClause =
    `WHERE "coverImage" LIKE '/anime-covers/%' OR "bannerImage" LIKE '/anime-covers/%'`;
  const limitClause =
    Number.isFinite(limit) && limit > 0 ? ` LIMIT ${Math.floor(limit)}` : "";
  const { rows } = await pool.query(
    `
      SELECT
        "id",
        "slug",
        "coverImage",
        "coverImageSource",
        "bannerImage",
        "bannerImageSource"
      FROM "anime"
      ${whereClause}
      ORDER BY "id" ASC
      ${limitClause}
    `,
  );

  console.log(
    `[media-backfill] found ${rows.length} anime rows with local imported media${dryRun ? " (dry run)" : ""}.`,
  );

  const uploadCache = new Map();
  let updatedRows = 0;
  let updatedAssets = 0;
  let missingAssets = 0;

  for (const row of rows) {
    const updates = {};

    if (isLocalImportedAsset(row.coverImage)) {
      const uploaded = await uploadFile(row.coverImage, uploadCache);
      if (uploaded) {
        updates.coverImage = uploaded.publicUrl;
        updates.coverImageSource = mapObjectStorageSource(row.coverImageSource);
        updatedAssets += 1;
      } else {
        missingAssets += 1;
        console.warn(
          `[media-backfill] missing local cover for anime ${row.id} (${row.slug}): ${row.coverImage}`,
        );
      }
    }

    if (isLocalImportedAsset(row.bannerImage)) {
      const uploaded = await uploadFile(row.bannerImage, uploadCache);
      if (uploaded) {
        updates.bannerImage = uploaded.publicUrl;
        updates.bannerImageSource = mapObjectStorageSource(row.bannerImageSource);
        updatedAssets += 1;
      } else {
        missingAssets += 1;
        console.warn(
          `[media-backfill] missing local banner for anime ${row.id} (${row.slug}): ${row.bannerImage}`,
        );
      }
    }

    const updateEntries = Object.entries(updates);
    if (updateEntries.length === 0) {
      continue;
    }

    updatedRows += 1;

    if (dryRun) {
      console.log(
        `[media-backfill] would update anime ${row.id} (${row.slug}): ${updateEntries
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")}`,
      );
      continue;
    }

    const assignments = updateEntries.map(
      ([key], index) => `"${key}" = $${index + 1}`,
    );
    const values = updateEntries.map(([, value]) => value);
    values.push(row.id);

    await pool.query(
      `
        UPDATE "anime"
        SET ${assignments.join(", ")}
        WHERE "id" = $${values.length}
      `,
      values,
    );
  }

  console.log(
    `[media-backfill] complete. Rows touched: ${updatedRows}. Assets handled: ${updatedAssets}. Missing assets: ${missingAssets}.`,
  );
}

try {
  await main();
} finally {
  await pool.end();
}
