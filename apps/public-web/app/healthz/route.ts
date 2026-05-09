import { NextResponse } from "next/server";
import { getAccountAccessMode } from "../../lib/account-source";
import { getCatalogAccessMode } from "../../lib/catalog-source";
import {
  getLegacyApiPublicBaseUrl,
  getPublicSiteUrl,
} from "../../lib/api";

export async function GET() {
  const publicLegacyEnv =
    process.env.NEXT_PUBLIC_LEGACY_API_BASE_URL ||
    process.env.LEGACY_API_BASE_URL ||
    null;
  const internalLegacyEnv =
    process.env.LEGACY_API_INTERNAL_ORIGIN ||
    process.env.LEGACY_API_INTERNAL_HOSTPORT ||
    process.env.LEGACY_API_BASE_URL ||
    null;
  const publicSiteEnv = process.env.NEXT_PUBLIC_SITE_URL || null;

  const warnings: string[] = [];
  if (!publicLegacyEnv) {
    warnings.push(
      "NEXT_PUBLIC_LEGACY_API_BASE_URL is not set; browser-facing media and metadata will fall back to local defaults.",
    );
  }
  if (!internalLegacyEnv) {
    warnings.push(
      "LEGACY_API_INTERNAL_ORIGIN or LEGACY_API_INTERNAL_HOSTPORT is not set; server-side requests will fall back to local defaults.",
    );
  }
  if (!publicSiteEnv) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL is not set; canonical metadata will fall back to local defaults.",
    );
  }

  return NextResponse.json({
    ok: true,
    service: "synx-public-web",
    configured: {
      publicSiteUrl: Boolean(publicSiteEnv),
      legacyApiPublicOrigin: Boolean(publicLegacyEnv),
      legacyApiServerOrigin: Boolean(internalLegacyEnv),
    },
    resolved: {
      publicSiteUrl: getPublicSiteUrl(),
      legacyApiPublicOrigin: getLegacyApiPublicBaseUrl(),
    },
    catalogAccessMode: getCatalogAccessMode(),
    accountAccessMode: getAccountAccessMode(),
    warnings,
  });
}
