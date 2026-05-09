import { describe, expect, it } from "vitest";
import {
  buildPublicWebRedirectTarget,
  getConfiguredPublicWebUrl,
  getPreferredPublicSiteOrigin,
  isLegacyFrontendRoute,
  isPublicConsumerRoute,
} from "./public-web";

describe("public-web cutover helpers", () => {
  it("recognizes consumer-facing routes that should move to Next", () => {
    expect(isPublicConsumerRoute("/")).toBe(true);
    expect(isPublicConsumerRoute("/browse")).toBe(true);
    expect(isPublicConsumerRoute("/anime/video-229")).toBe(true);
    expect(isPublicConsumerRoute("/watch/video-229/3")).toBe(true);
    expect(isPublicConsumerRoute("/admin")).toBe(false);
    expect(isPublicConsumerRoute("/api/public/home")).toBe(false);
  });

  it("keeps admin in the legacy frontend route set", () => {
    expect(isLegacyFrontendRoute("/admin")).toBe(true);
    expect(isLegacyFrontendRoute("/settings")).toBe(true);
    expect(isLegacyFrontendRoute("/api/public/home")).toBe(false);
  });

  it("normalizes PUBLIC_WEB_URL only when it is a valid absolute URL", () => {
    expect(
      getConfiguredPublicWebUrl({
        PUBLIC_WEB_URL: "https://public.example",
      } as NodeJS.ProcessEnv),
    ).toBe("https://public.example/");
    expect(
      getConfiguredPublicWebUrl({
        PUBLIC_WEB_URL: "/relative/path",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("builds a redirect target that preserves path, query, and hash", () => {
    expect(
      buildPublicWebRedirectTarget(
        "https://legacy.example/anime/video-229?from=legacy#watch",
        {
          PUBLIC_WEB_URL: "https://public.example",
        } as NodeJS.ProcessEnv,
      ),
    ).toBe("https://public.example/anime/video-229?from=legacy#watch");
  });

  it("does not redirect admin or api paths", () => {
    expect(
      buildPublicWebRedirectTarget("https://legacy.example/admin", {
        PUBLIC_WEB_URL: "https://public.example",
      } as NodeJS.ProcessEnv,
      ),
    ).toBeNull();
    expect(
      buildPublicWebRedirectTarget("https://legacy.example/api/public/home", {
        PUBLIC_WEB_URL: "https://public.example",
      } as NodeJS.ProcessEnv,
      ),
    ).toBeNull();
  });

  it("prefers PUBLIC_WEB_URL for public-site origin generation", () => {
    expect(
      getPreferredPublicSiteOrigin("https://legacy.example/robots.txt", {
        PUBLIC_WEB_URL: "https://public.example",
        SITE_URL: "https://legacy.example",
      } as NodeJS.ProcessEnv),
    ).toBe("https://public.example");
  });
});
