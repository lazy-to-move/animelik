import { z } from "zod";
import {
  isScraperQueueMode,
} from "../lib/scraper-execution";
import { enqueueScrapeJob } from "./scraper/job-queue";
import {
  sourceSiteSchema,
} from "./admin-scraper-read-service";
import {
  runImportFromSourceOperation,
  runRefreshAnimeMetadataOperation,
  runSyncAllEpisodesOperation,
} from "./scraper/operations";

export const importFromSourceAdminSchema = z.object({
  source: sourceSiteSchema.default("witanime"),
  slug: z.string().trim().min(1, "Enter an anime slug."),
  importEpisodes: z.boolean().default(true),
});

export const animeAdminActionSchema = z.object({
  animeId: z.number().int().positive(),
});

function normalizeStoredSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

function queuedResponse(jobId: number, message: string) {
  return {
    success: true as const,
    queued: true as const,
    jobId,
    message,
  };
}

export async function importFromSourceForAdmin(input: {
  userId: number;
  source: z.infer<typeof sourceSiteSchema>;
  slug: string;
  importEpisodes: boolean;
}) {
  const slug = normalizeStoredSlug(input.slug);

  if (isScraperQueueMode()) {
    const job = await enqueueScrapeJob({
      type: "import_from_source",
      payload: {
        source: input.source,
        slug,
        importEpisodes: input.importEpisodes,
      },
      requestedByUserId: input.userId,
    });

    return queuedResponse(
      job.id,
      "Import job was queued for the background worker.",
    );
  }

  return runImportFromSourceOperation({
    source: input.source,
    slug,
    importEpisodes: input.importEpisodes,
  });
}

export async function syncAllEpisodesForAdmin(input: {
  userId: number;
  animeId: number;
}) {
  if (isScraperQueueMode()) {
    const job = await enqueueScrapeJob({
      type: "sync_all_episodes",
      payload: { animeId: input.animeId },
      requestedByUserId: input.userId,
    });

    return queuedResponse(
      job.id,
      "Episode source sync was queued for the background worker.",
    );
  }

  return runSyncAllEpisodesOperation({ animeId: input.animeId });
}

export async function refreshAnimeMetadataForAdmin(input: {
  userId: number;
  animeId: number;
}) {
  if (isScraperQueueMode()) {
    const job = await enqueueScrapeJob({
      type: "refresh_anime_metadata",
      payload: { animeId: input.animeId },
      requestedByUserId: input.userId,
    });

    return queuedResponse(
      job.id,
      "Metadata refresh was queued for the background worker.",
    );
  }

  return runRefreshAnimeMetadataOperation({ animeId: input.animeId });
}
