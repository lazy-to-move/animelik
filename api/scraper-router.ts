import { inArray } from "drizzle-orm";
import { z } from "zod";
import { anime } from "@db/schema";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  getScraperProvider,
  listScraperProviders,
} from "./services/scraper/provider-registry";
import { SOURCE_SITE_IDS } from "./services/scraper/types";
import {
  getScraperExecutionMessage,
  getScraperExecutionMode,
  isScraperQueueMode,
} from "./lib/scraper-execution";
import {
  enqueueScrapeJob,
  listRecentScrapeJobs,
} from "./services/scraper/job-queue";
import {
  runImportFromSourceOperation,
  runRefreshAnimeMetadataOperation,
  runScrapeAnimeOperation,
  runSyncAllEpisodesOperation,
  runSyncEpisodeSourcesOperation,
} from "./services/scraper/operations";

const sourceSiteSchema = z.enum(SOURCE_SITE_IDS);

function normalizeStoredSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function queuedResponse(jobId: number, message: string) {
  return {
    success: true as const,
    queued: true as const,
    jobId,
    message,
  };
}

export const scraperRouter = createRouter({
  scrapeAnime: adminQuery
    .input(
      z.object({
        slug: z.string(),
        source: sourceSiteSchema.default("witanime"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const slug = normalizeStoredSlug(input.slug);
        if (isScraperQueueMode()) {
          const job = await enqueueScrapeJob({
            type: "import_from_source",
            payload: {
              source: input.source,
              slug,
              importEpisodes: false,
            },
            requestedByUserId: ctx.user.id,
          });

          return queuedResponse(
            job.id,
            "Anime scrape was queued for the background worker."
          );
        }

        return await runScrapeAnimeOperation({
          source: input.source,
          slug,
        });
      } catch (error) {
        console.error("Error in scrapeAnime:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  syncEpisodeSources: adminQuery
    .input(z.object({ episodeId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await runSyncEpisodeSourcesOperation(input);
      } catch (error) {
        console.error("Error in syncEpisodeSources:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  syncAllEpisodes: adminQuery
    .input(z.object({ animeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (isScraperQueueMode()) {
          const job = await enqueueScrapeJob({
            type: "sync_all_episodes",
            payload: { animeId: input.animeId },
            requestedByUserId: ctx.user.id,
          });

          return queuedResponse(
            job.id,
            "Episode source sync was queued for the background worker."
          );
        }

        return await runSyncAllEpisodesOperation(input);
      } catch (error) {
        console.error("Error in syncAllEpisodes:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  refreshAnimeMetadata: adminQuery
    .input(z.object({ animeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (isScraperQueueMode()) {
          const job = await enqueueScrapeJob({
            type: "refresh_anime_metadata",
            payload: { animeId: input.animeId },
            requestedByUserId: ctx.user.id,
          });

          return queuedResponse(
            job.id,
            "Metadata refresh was queued for the background worker."
          );
        }

        return await runRefreshAnimeMetadataOperation(input);
      } catch (error) {
        console.error("Error in refreshAnimeMetadata:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  getLatestFromSource: adminQuery
    .input(
      z.object({
        source: sourceSiteSchema.default("witanime"),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      try {
        const provider = getScraperProvider(input.source);
        const latest = await provider.scrapeLatestAnime(input.limit);
        return { success: true, data: latest };
      } catch (error) {
        console.error("Error in getLatestFromSource:", error);
        return { success: false, error: getErrorMessage(error), data: [] };
      }
    }),

  searchSource: adminQuery
    .input(
      z.object({
        source: sourceSiteSchema.default("witanime"),
        query: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const provider = getScraperProvider(input.source);
        const results = await provider.searchAnime(input.query);
        return { success: true, data: results };
      } catch (error) {
        console.error("Error in searchSource:", error);
        return { success: false, error: getErrorMessage(error), data: [] };
      }
    }),

  importFromSource: adminQuery
    .input(
      z.object({
        source: sourceSiteSchema.default("witanime"),
        slug: z.string(),
        importEpisodes: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const slug = normalizeStoredSlug(input.slug);

        if (isScraperQueueMode()) {
          const job = await enqueueScrapeJob({
            type: "import_from_source",
            payload: {
              source: input.source,
              slug,
              importEpisodes: input.importEpisodes,
            },
            requestedByUserId: ctx.user.id,
          });

          return queuedResponse(
            job.id,
            "Import job was queued for the background worker."
          );
        }

        return await runImportFromSourceOperation({
          source: input.source,
          slug,
          importEpisodes: input.importEpisodes,
        });
      } catch (error) {
        console.error("Error in importFromSource:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  getExecutionMode: adminQuery.query(() => {
    const mode = getScraperExecutionMode();
    return {
      mode,
      queued: mode === "queue",
      message: getScraperExecutionMessage(),
    };
  }),

  listScrapeJobs: adminQuery
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = getDb();
      const jobs = await listRecentScrapeJobs({ limit: input.limit, db });
      const animeIds = Array.from(
        new Set(
          jobs
            .map((job) => job.payload?.animeId)
            .filter((animeId): animeId is number => Number.isFinite(animeId))
        )
      );

      const animeRecords =
        animeIds.length > 0
          ? await db
              .select({
                id: anime.id,
                title: anime.title,
                slug: anime.slug,
                sourceSite: anime.sourceSite,
              })
              .from(anime)
              .where(inArray(anime.id, animeIds))
          : [];
      const animeById = new Map(
        animeRecords.map((record) => [record.id, record] as const)
      );

      return jobs.map((job) => {
        const relatedAnime =
          typeof job.payload?.animeId === "number"
            ? animeById.get(job.payload.animeId)
            : undefined;

        return {
          ...job,
          label:
            relatedAnime?.title ??
            job.payload?.slug ??
            `${job.type.replace(/_/g, " ")}`,
          animeTitle: relatedAnime?.title ?? null,
          animeSlug: relatedAnime?.slug ?? job.payload?.slug ?? null,
          source:
            job.payload?.source ?? relatedAnime?.sourceSite ?? null,
        };
      });
    }),

  getSources: publicQuery.query(() => {
    return listScraperProviders();
  }),

  getAvailableServers: publicQuery.query(() => {
    return [
      { id: "streamwish", name: "StreamWish", quality: ["sd", "hd", "fhd"] },
      { id: "mp4upload", name: "MP4Upload", quality: ["sd", "hd", "fhd"] },
      { id: "yonaplay", name: "YonaPlay", quality: ["hd"] },
      { id: "videa", name: "Videa", quality: ["sd", "hd", "fhd"] },
    ];
  }),
});
