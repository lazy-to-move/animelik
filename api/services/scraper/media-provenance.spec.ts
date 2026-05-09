import { describe, expect, it } from "vitest";
import {
  inferExistingImageSource,
  resolveStoredImageSource,
} from "./media-provenance";

describe("inferExistingImageSource", () => {
  it("treats imported cover paths as legacy disk assets", () => {
    expect(inferExistingImageSource("/anime-covers/one-piece.jpg")).toBe("legacy_disk");
  });

  it("treats remote urls as legacy remote assets", () => {
    expect(inferExistingImageSource("https://cdn.example.com/poster.webp")).toBe("legacy_remote");
  });

  it("returns null for empty values", () => {
    expect(inferExistingImageSource("")).toBeNull();
    expect(inferExistingImageSource(null)).toBeNull();
  });
});

describe("resolveStoredImageSource", () => {
  it("preserves an existing source tag when the url is unchanged", () => {
    expect(
      resolveStoredImageSource({
        origin: "source",
        finalUrl: "/anime-covers/bleach.jpg",
        existingUrl: "/anime-covers/bleach.jpg",
        existingSource: "source_disk",
      }),
    ).toBe("source_disk");
  });

  it("marks downloaded source images stored on disk", () => {
    expect(
      resolveStoredImageSource({
        origin: "source",
        finalUrl: "/anime-covers/naruto.jpg",
        storedStorageKind: "disk",
      }),
    ).toBe("source_disk");
  });

  it("marks downloaded metadata images stored in object storage", () => {
    expect(
      resolveStoredImageSource({
        origin: "metadata",
        finalUrl: "https://cdn.example.com/anime-covers/hxh-banner.webp",
        storedStorageKind: "object_storage",
      }),
    ).toBe("metadata_object_storage");
  });

  it("preserves legacy object storage tags when the url is unchanged", () => {
    expect(
      resolveStoredImageSource({
        origin: "source",
        finalUrl: "https://cdn.example.com/anime-covers/old-cover.webp",
        existingUrl: "https://cdn.example.com/anime-covers/old-cover.webp",
        existingSource: "legacy_object_storage",
      }),
    ).toBe("legacy_object_storage");
  });

  it("uses the fallback source when a banner reuses the chosen cover asset", () => {
    expect(
      resolveStoredImageSource({
        origin: "metadata",
        finalUrl: "/anime-covers/gintama.jpg",
        fallbackSource: "source_disk",
      }),
    ).toBe("source_disk");
  });

  it("classifies untouched remote metadata assets", () => {
    expect(
      resolveStoredImageSource({
        origin: "metadata",
        finalUrl: "https://image.tmdb.org/t/p/original/poster.jpg",
      }),
    ).toBe("metadata_remote");
  });
});
