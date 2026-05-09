import { z } from "zod";
import {
  getScraperExecutionMessage,
  getScraperExecutionMode,
  getScraperQueueBackend,
} from "../lib/scraper-execution";
import {
  getScraperProvider,
  listScraperProviders,
} from "./scraper/provider-registry";
import { SOURCE_SITE_IDS } from "./scraper/types";

export const sourceSiteSchema = z.enum(SOURCE_SITE_IDS);

export const latestSourceQuerySchema = z.object({
  source: sourceSiteSchema.default("witanime"),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const searchSourceQuerySchema = z.object({
  source: sourceSiteSchema.default("witanime"),
  query: z.string().trim().min(1, "Enter a search term."),
});

export function getAdminScraperExecutionDetails() {
  const mode = getScraperExecutionMode();
  return {
    mode,
    backend: getScraperQueueBackend(),
    queued: mode === "queue",
    message: getScraperExecutionMessage(),
  };
}

export function listAdminScraperSources() {
  return listScraperProviders();
}

export async function getLatestAnimeFromSource(input: {
  source: z.infer<typeof sourceSiteSchema>;
  limit?: number;
}) {
  const provider = getScraperProvider(input.source);
  const data = await provider.scrapeLatestAnime(input.limit ?? 12);
  return { success: true as const, data };
}

export async function searchAnimeFromSource(input: {
  source: z.infer<typeof sourceSiteSchema>;
  query: string;
}) {
  const provider = getScraperProvider(input.source);
  const data = await provider.searchAnime(input.query);
  return { success: true as const, data };
}
