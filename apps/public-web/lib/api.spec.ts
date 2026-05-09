import { afterEach, describe, expect, it } from "vitest";
import {
  getLegacyApiPublicBaseUrl,
  getLegacyApiServerBaseUrl,
  getPublicSiteUrl,
  resolveMediaUrl,
} from "./api";

const originalLegacyApiBaseUrl = process.env.LEGACY_API_BASE_URL;
const originalLegacyApiInternalOrigin = process.env.LEGACY_API_INTERNAL_ORIGIN;
const originalLegacyApiInternalHostport =
  process.env.LEGACY_API_INTERNAL_HOSTPORT;
const originalPublicLegacyApiBaseUrl =
  process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL;
const originalPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalLegacyApiBaseUrl === undefined) {
    delete process.env.LEGACY_API_BASE_URL;
  } else {
    process.env.LEGACY_API_BASE_URL = originalLegacyApiBaseUrl;
  }

  if (originalPublicLegacyApiBaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL = originalPublicLegacyApiBaseUrl;
  }

  if (originalLegacyApiInternalOrigin === undefined) {
    delete process.env.LEGACY_API_INTERNAL_ORIGIN;
  } else {
    process.env.LEGACY_API_INTERNAL_ORIGIN = originalLegacyApiInternalOrigin;
  }

  if (originalLegacyApiInternalHostport === undefined) {
    delete process.env.LEGACY_API_INTERNAL_HOSTPORT;
  } else {
    process.env.LEGACY_API_INTERNAL_HOSTPORT = originalLegacyApiInternalHostport;
  }

  if (originalPublicSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalPublicSiteUrl;
  }
});

describe("public-web api helpers", () => {
  it("uses the explicit server-side legacy API origin when configured", () => {
    process.env.LEGACY_API_INTERNAL_ORIGIN =
      "https://internal-legacy.synx.example/";
    process.env.LEGACY_API_BASE_URL = "https://legacy.synx.example/";

    expect(getLegacyApiServerBaseUrl()).toBe(
      "https://internal-legacy.synx.example",
    );
  });

  it("builds the server-side origin from a hostport when needed", () => {
    delete process.env.LEGACY_API_INTERNAL_ORIGIN;
    process.env.LEGACY_API_INTERNAL_HOSTPORT = "synx-app:10000";
    process.env.LEGACY_API_BASE_URL = "https://legacy.synx.example/";

    expect(getLegacyApiServerBaseUrl()).toBe("http://synx-app:10000");
  });

  it("falls back to the public legacy API base url for public assets", () => {
    delete process.env.LEGACY_API_INTERNAL_ORIGIN;
    delete process.env.LEGACY_API_INTERNAL_HOSTPORT;
    delete process.env.LEGACY_API_BASE_URL;
    process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL =
      "https://public-legacy.synx.example/";

    expect(getLegacyApiPublicBaseUrl()).toBe(
      "https://public-legacy.synx.example",
    );
  });

  it("normalizes relative media paths against the public legacy API origin", () => {
    process.env.LEGACY_API_INTERNAL_ORIGIN =
      "https://internal-legacy.synx.example/";
    process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL =
      "https://public-legacy.synx.example/";

    expect(resolveMediaUrl("/anime-covers/one-piece.webp")).toBe(
      "https://public-legacy.synx.example/anime-covers/one-piece.webp",
    );
    expect(resolveMediaUrl("anime-covers/one-piece.webp")).toBe(
      "https://public-legacy.synx.example/anime-covers/one-piece.webp",
    );
  });

  it("preserves already absolute media urls", () => {
    const absolute = "https://cdn.example.com/anime-covers/one-piece.webp";

    expect(resolveMediaUrl(absolute)).toBe(absolute);
    expect(resolveMediaUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("normalizes the public site url without trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://public.synx.example///";

    expect(getPublicSiteUrl()).toBe("https://public.synx.example");
  });
});
