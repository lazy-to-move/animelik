import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(workspaceRoot, "../..");
const knownRemoteHosts = [
  "127.0.0.1",
  "localhost",
  "witanime.you",
  "ww3.okanime.xyz",
  "w1.anime4up.rest",
  "animelek.top",
  "ristoanime.co",
  "watch.stardima.com",
  "www.stardima.com",
  "image.tmdb.org",
  "cdn.myanimelist.net",
  "api-cdn.myanimelist.net",
];

function buildRemotePatterns() {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
  const seen = new Set<string>();

  const pushPattern = (protocol: "http" | "https", hostname: string, port = "") => {
    const key = `${protocol}:${hostname}:${port}`;
    if (seen.has(key)) return;
    seen.add(key);
    patterns.push({
      protocol,
      hostname,
      port,
      pathname: "/**",
    });
  };

  for (const hostname of knownRemoteHosts) {
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      pushPattern("http", hostname);
      pushPattern("https", hostname);
      continue;
    }

    pushPattern("https", hostname);
  }

  for (const rawUrl of [
    process.env.LEGACY_API_INTERNAL_ORIGIN,
    process.env.LEGACY_API_BASE_URL,
    process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    if (!rawUrl) continue;

    try {
      const parsed = new URL(rawUrl);
      const protocol = parsed.protocol.replace(":", "");
      if (protocol !== "http" && protocol !== "https") continue;
      pushPattern(protocol, parsed.hostname, parsed.port);
    } catch {
      // Ignore malformed optional envs here; runtime config already warns elsewhere.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  images: {
    remotePatterns: buildRemotePatterns(),
  },
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
