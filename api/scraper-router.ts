import { inArray } from "drizzle-orm";
import { z } from "zod";
import { anime } from "@db/schema";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { isScraperQueueMode } from "./lib/scraper-execution";
import { getDb } from "./queries/connection";
import {
  enqueueScrapeJob,
  listRecentScrapeJobs,
} from "./services/scraper/job-queue";
import {
  runScrapeAnimeOperation,
  runSyncEpisodeSourcesOperation,
} from "./services/scraper/operations";
import {
  getAdminScraperExecutionDetails,
  getLatestAnimeFromSource,
  latestSourceQuerySchema,
  listAdminScraperSources,
  searchAnimeFromSource,
  searchSourceQuerySchema,
  sourceSiteSchema,
} from "./services/admin-scraper-read-service";
import {
  animeAdminActionSchema,
  importFromSourceAdminSchema,
  importFromSourceForAdmin,
  refreshAnimeMetadataForAdmin,
  syncAllEpisodesForAdmin,
} from "./services/admin-scraper-service";
import {
  queueProbeAdminSchema,
  runQueueProbeForAdmin,
} from "./services/admin-scraper-queue-service";

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
            "Anime scrape was queued for the background worker.",
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
    .input(animeAdminActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await syncAllEpisodesForAdmin({
          userId: ctx.user.id,
          animeId: input.animeId,
        });
      } catch (error) {
        console.error("Error in syncAllEpisodes:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  refreshAnimeMetadata: adminQuery
    .input(animeAdminActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await refreshAnimeMetadataForAdmin({
          userId: ctx.user.id,
          animeId: input.animeId,
        });
      } catch (error) {
        console.error("Error in refreshAnimeMetadata:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  runQueueProbe: adminQuery
    .input(queueProbeAdminSchema.optional())
    .mutation(async ({ ctx, input }) => {
      try {
        return await runQueueProbeForAdmin({
          userId: ctx.user.id,
          probeId: input?.probeId,
        });
      } catch (error) {
        console.error("Error in runQueueProbe:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  getLatestFromSource: adminQuery
    .input(latestSourceQuerySchema)
    .query(async ({ input }) => {
      try {
        return await getLatestAnimeFromSource(input);
      } catch (error) {
        console.error("Error in getLatestFromSource:", error);
        return { success: false, error: getErrorMessage(error), data: [] };
      }
    }),

  searchSource: adminQuery
    .input(searchSourceQuerySchema)
    .query(async ({ input }) => {
      try {
        return await searchAnimeFromSource(input);
      } catch (error) {
        console.error("Error in searchSource:", error);
        return { success: false, error: getErrorMessage(error), data: [] };
      }
    }),

  importFromSource: adminQuery
    .input(importFromSourceAdminSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await importFromSourceForAdmin({
          userId: ctx.user.id,
          source: input.source,
          slug: input.slug,
          importEpisodes: input.importEpisodes,
        });
      } catch (error) {
        console.error("Error in importFromSource:", error);
        return { success: false, error: getErrorMessage(error) };
      }
    }),

  getExecutionMode: adminQuery.query(() => {
    return getAdminScraperExecutionDetails();
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
          probeId: job.payload?.probeId ?? null,
          label:
            job.type === "queue_probe"
              ? `Queue probe ${job.payload?.probeId ?? job.id}`
              :
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
    return listAdminScraperSources();
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
