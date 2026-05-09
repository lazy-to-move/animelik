export type MetadataProviderSource = "source_site" | "jikan" | "tvmaze" | "legacy";

export type ImageOrigin = "source" | "metadata";

export type StoredImageStorageKind = "disk" | "object_storage";

export type ImageSourceTag =
  | "source_disk"
  | "source_object_storage"
  | "source_remote"
  | "metadata_disk"
  | "metadata_object_storage"
  | "metadata_remote"
  | "legacy_disk"
  | "legacy_object_storage"
  | "legacy_remote";

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isLocalImportedPath(value: string) {
  return value.startsWith("/anime-covers/");
}

export function inferExistingImageSource(url: string | null | undefined): ImageSourceTag | null {
  if (!url) return null;
  const normalized = url.trim();
  if (!normalized) return null;
  if (isLocalImportedPath(normalized)) return "legacy_disk";
  if (isRemoteUrl(normalized)) return "legacy_remote";
  return null;
}

export function resolveStoredImageSource(input: {
  origin: ImageOrigin;
  finalUrl: string | null | undefined;
  storedStorageKind?: StoredImageStorageKind | null;
  existingUrl?: string | null;
  existingSource?: string | null;
  fallbackSource?: string | null;
}) {
  const finalUrl = input.finalUrl?.trim() ?? "";
  if (!finalUrl) {
    return null;
  }

  if (input.existingSource && input.existingUrl?.trim() === finalUrl) {
    return input.existingSource;
  }

  if (input.fallbackSource) {
    return input.fallbackSource;
  }

  if (input.storedStorageKind === "disk") {
    return `${input.origin}_disk` as const;
  }

  if (input.storedStorageKind === "object_storage") {
    return `${input.origin}_object_storage` as const;
  }

  if (isLocalImportedPath(finalUrl)) {
    return `${input.origin}_disk` as const;
  }

  if (isRemoteUrl(finalUrl)) {
    return `${input.origin}_remote` as const;
  }

  return inferExistingImageSource(finalUrl);
}
