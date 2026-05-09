import type { MetadataRoute } from "next";
import { getBrowseData, getPublicSiteUrl } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const browse = await getBrowseData({ limit: "500" });

  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/browse` },
    { url: `${siteUrl}/schedule` },
    ...browse.items.map((item) => ({
      url: `${siteUrl}/anime/${item.slug}`,
    })),
  ];
}
