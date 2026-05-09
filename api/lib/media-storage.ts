import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { writeFileSync } from "fs";
import { join } from "path";
import type { StoredImageStorageKind } from "../services/scraper/media-provenance";
import { ensureImportedAnimeCoversDir } from "./imported-media";

type MediaStorageMode = "local" | "s3";

function normalizeFileExtension(contentType: string, sourceUrl: string) {
  const derivedFromType =
    contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") ?? "";
  const derivedFromUrl = sourceUrl.split(".").pop()?.split("?")[0] ?? "";
  const raw = derivedFromType || derivedFromUrl || "jpg";
  return raw.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function getMediaStorageMode(): MediaStorageMode {
  const configured = (process.env.MEDIA_STORAGE_MODE ?? "").trim().toLowerCase();
  if (configured === "s3") return "s3";
  if (configured === "local") return "local";
  return process.env.S3_MEDIA_BUCKET ? "s3" : "local";
}

function getMediaPublicBaseUrl() {
  return trimSlashes(process.env.MEDIA_PUBLIC_BASE_URL ?? "");
}

function createS3Client() {
  const region = process.env.S3_MEDIA_REGION?.trim();
  const bucket = process.env.S3_MEDIA_BUCKET?.trim();
  const accessKeyId = process.env.S3_MEDIA_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_MEDIA_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 media storage is enabled but one or more required S3_MEDIA_* variables are missing.",
    );
  }

  const endpoint = process.env.S3_MEDIA_ENDPOINT?.trim() || undefined;
  const forcePathStyle =
    (process.env.S3_MEDIA_FORCE_PATH_STYLE ?? "").trim().toLowerCase() === "true";

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

export async function storeImportedAnimeImage(input: {
  slug: string;
  sourceUrl: string;
  contentType: string;
  buffer: Buffer;
}) {
  const ext = normalizeFileExtension(input.contentType, input.sourceUrl);
  const filename = `${trimSlashes(input.slug)}.${ext}`;
  const mode = getMediaStorageMode();

  if (mode === "local") {
    const coversDir = ensureImportedAnimeCoversDir();
    writeFileSync(join(coversDir, filename), input.buffer);
    return {
      url: `/anime-covers/${filename}`,
      storage: "disk" as StoredImageStorageKind,
    };
  }

  const bucket = process.env.S3_MEDIA_BUCKET!.trim();
  const key = `anime-covers/${filename}`;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const publicBaseUrl = getMediaPublicBaseUrl();
  if (!publicBaseUrl) {
    throw new Error(
      "S3 media storage requires MEDIA_PUBLIC_BASE_URL so stored images can be served to clients.",
    );
  }

  return {
    url: `${publicBaseUrl}/${key}`,
    storage: "object_storage" as StoredImageStorageKind,
  };
}

export function getConfiguredMediaStorageMode() {
  return getMediaStorageMode();
}

export async function verifyConfiguredMediaStorage() {
  if (getMediaStorageMode() !== "s3") {
    return {
      mode: "local" as const,
      verified: false,
      bucket: null,
      message: "Local media storage mode does not require remote connectivity checks.",
    };
  }

  const bucket = process.env.S3_MEDIA_BUCKET!.trim();
  await getS3Client().send(
    new HeadBucketCommand({
      Bucket: bucket,
    }),
  );

  return {
    mode: "s3" as const,
    verified: true,
    bucket,
    message: `Verified object storage bucket access for ${bucket}.`,
  };
}
