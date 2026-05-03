import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { anime, episodes, categories } from "@db/schema";
import { getScraperProvider, listScraperProviders } from "./services/scraper/provider-registry";
import { SOURCE_SITE_IDS, type ScraperAnime, type SourceSiteId } from "./services/scraper/types";
import { enrichAnimeMetadata } from "./services/scraper/metadata-enrichment";

const sourceSiteSchema = z.enum(SOURCE_SITE_IDS);

function normalizeStoredSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

async function downloadImage(url: string, slug: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1024) return null;

    const coversDir = join(process.cwd(), "public", "anime-covers");
    if (!existsSync(coversDir)) mkdirSync(coversDir, { recursive: true });
    const ext =
      contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") ||
      url.split(".").pop()?.split("?")[0] ||
      "jpg";
    const filename = `${slug}.${ext}`;
    writeFileSync(join(coversDir, filename), Buffer.from(buffer));
    return `/anime-covers/${filename}`;
  } catch (err) {
    console.error("Failed to download image:", err);
    return null;
  }
}

function toCategorySlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategoryName(categoryName?: string) {
  if (!categoryName) return undefined;

  const parts = categoryName
    .split(/\||,|،|\//)
    .map((part) => part.trim())
    .filter(Boolean);

  const selected = (parts[0] ?? categoryName).replace(/\s+/g, " ").trim();
  return selected.slice(0, 100) || undefined;
}

function humanizeSlug(slug: string) {
  return normalizeStoredSlug(slug)
    .replace(/^anime\//i, "")
    .replace(/^انمي-?/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function normalizeTitle(title: string | undefined, slug: string) {
  const cleaned = (title ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned || ["risto", "تصفح", "unknown"].includes(cleaned.toLowerCase())) {
    return humanizeSlug(slug);
  }

  return cleaned.slice(0, 255);
}

function normalizeSynopsis(synopsis?: string) {
  if (!synopsis) return "";

  const cleaned = synopsis
    .replace(/\s+/g, " ")
    .replace(/\{"prefetch":.*$/i, "")
    .replace(/عودة الى أعلي.*$/i, "")
    .trim();

  return cleaned.slice(0, 4000);
}

function normalizeStudio(studio?: string) {
  if (!studio) return undefined;
  const cleaned = studio.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 100) : undefined;
}

function normalizeDuration(duration?: number) {
  if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > 400) return undefined;
  return Math.round(duration);
}

function normalizeReleaseYear(year?: number) {
  if (!year || !Number.isFinite(year)) return undefined;
  const currentYear = new Date().getFullYear() + 2;
  return year >= 1950 && year <= currentYear ? year : undefined;
}

function normalizeRating(rating?: string) {
  if (!rating) return undefined;

  const text = rating.replace(/\s+/g, " ").trim();
  const explicitMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i);
  const numeric = explicitMatch?.[1] ?? text.match(/\d+(?:\.\d+)?/)?.[0];
  if (!numeric) return undefined;

  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value) || value <= 0 || value > 10) return undefined;
  return `${value.toFixed(1)} / 10`;
}

function inferAnimeStatus(
  status: ScraperAnime["status"],
  episodesCount: number,
  existingStatus?: ScraperAnime["status"] | null,
): ScraperAnime["status"] {
  if (status === "completed") return "completed";
  if (status === "ongoing") return "ongoing";

  if (episodesCount > 0) {
    return existingStatus === "completed" ? "completed" : "ongoing";
  }

  return existingStatus ?? "upcoming";
}

function normalizeImagePath(path?: string | null) {
  if (!path) return null;
  const cleaned = path.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("/anime-covers/") || cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return null;
}

function choosePreferredImage(primary?: string | null, fallback?: string | null) {
  return normalizeImagePath(primary) ?? normalizeImagePath(fallback) ?? null;
}

function normalizeEpisodeTitle(title: string | undefined, episodeNumber: number) {
  const cleaned = (title ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return `Episode ${episodeNumber}`;
  return cleaned.slice(0, 255);
}

function normalizeEpisodeThumbnail(thumbnail?: string) {
  if (!thumbnail) return undefined;
  const cleaned = thumbnail.trim();
  return cleaned || undefined;
}

async function ensureCategoryId(db: ReturnType<typeof getDb>, categoryName?: string) {
  const normalizedName = normalizeCategoryName(categoryName);
  if (!normalizedName) return undefined;

  const existingCat = await db.select().from(categories).where(eq(categories.name, normalizedName)).limit(1);
  if (existingCat.length > 0) return existingCat[0].id;

  const slug = toCategorySlug(normalizedName) || `category-${Date.now()}`;
  const [newCat] = await db.insert(categories).values({ name: normalizedName, slug }).$returningId();
  return newCat.id;
}

function toScoreValue(rating?: string) {
  if (!rating) return "0.00";
  const numeric = Number.parseFloat(rating.replace(",", ".").match(/\d+(\.\d+)?/)?.[0] ?? "");
  if (Number.isNaN(numeric)) return "0.00";
  return numeric.toFixed(2);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mergeScrapedAndEnrichedAnime(siteData: ScraperAnime, enrichedData: Partial<ScraperAnime>): ScraperAnime {
  return {
    ...siteData,
    ...enrichedData,
    synopsis: normalizeSynopsis(siteData.synopsis) || normalizeSynopsis(enrichedData.synopsis) || "",
    status: enrichedData.status ?? siteData.status,
    type: siteData.type,
    episodesCount: siteData.episodesCount,
  };
}

async function persistAnimeRecord({
  db,
  source,
  slug,
  scrapedData,
  scrapedEpisodesCount,
}: {
  db: ReturnType<typeof getDb>;
  source: SourceSiteId;
  slug: string;
  scrapedData: ScraperAnime;
  scrapedEpisodesCount: number;
}) {
  const normalizedSlug = normalizeStoredSlug(slug);
  const existingAnime = await db.select().from(anime).where(eq(anime.slug, normalizedSlug)).limit(1);
  const categoryId = await ensureCategoryId(db, scrapedData.categoryName);

  let savedCoverImage = scrapedData.coverImage ?? null;
  if (scrapedData.coverImage?.startsWith("http")) {
    savedCoverImage = (await downloadImage(scrapedData.coverImage, normalizedSlug)) || scrapedData.coverImage;
  }

  let savedBannerImage = scrapedData.bannerImage ?? savedCoverImage ?? null;
  if (scrapedData.bannerImage?.startsWith("http") && scrapedData.bannerImage !== scrapedData.coverImage) {
    savedBannerImage = (await downloadImage(scrapedData.bannerImage, `${normalizedSlug}-banner`)) || scrapedData.bannerImage;
  }

  const normalizedTitle = normalizeTitle(scrapedData.title, normalizedSlug);
  const normalizedSynopsis = normalizeSynopsis(scrapedData.synopsis);
  const normalizedRating = normalizeRating(scrapedData.rating);
  const normalizedStudio = normalizeStudio(scrapedData.studio);
  const normalizedReleaseYear = normalizeReleaseYear(scrapedData.releaseYear);
  const normalizedDuration = normalizeDuration(scrapedData.duration);
  const existing = existingAnime[0];
  const normalizedEpisodesCount = Math.min(scrapedEpisodesCount || scrapedData.episodesCount, 500);
  const normalizedStatus = inferAnimeStatus(scrapedData.status, normalizedEpisodesCount, existing?.status ?? undefined);

  const payload = {
    title: normalizedTitle,
    titleJp: scrapedData.titleJp ?? existing?.titleJp ?? undefined,
    synopsis: normalizedSynopsis || existing?.synopsis || "",
    coverImage: choosePreferredImage(savedCoverImage, existing?.coverImage),
    bannerImage: choosePreferredImage(savedBannerImage, existing?.bannerImage) ?? choosePreferredImage(savedCoverImage, existing?.coverImage),
    status: normalizedStatus,
    type: scrapedData.type,
    episodesCount: normalizedEpisodesCount,
    externalId: scrapedData.externalId ?? existing?.externalId ?? undefined,
    externalSlug: normalizedSlug,
    sourceSite: source,
    lastScrapedAt: new Date(),
    rating: normalizedRating ?? existing?.rating ?? undefined,
    releaseYear: normalizedReleaseYear ?? existing?.releaseYear ?? undefined,
    studio: normalizedStudio ?? existing?.studio ?? undefined,
    duration: normalizedDuration ?? existing?.duration ?? undefined,
    score: normalizedRating ? toScoreValue(normalizedRating) : (existing?.score ?? "0.00"),
    categoryId,
  } as const;

  if (existingAnime.length > 0) {
    await db.update(anime).set(payload).where(eq(anime.id, existingAnime[0].id));
    return { animeId: existingAnime[0].id, action: "updated" as const };
  }

  const [inserted] = await db.insert(anime).values({
    ...payload,
    slug: normalizedSlug,
  }).$returningId();

  return { animeId: inserted.id, action: "created" as const };
}

async function reconcileEpisodesForAnime({
  db,
  animeId,
  scrapedEpisodes,
}: {
  db: ReturnType<typeof getDb>;
  animeId: number;
  scrapedEpisodes: Awaited<ReturnType<ReturnType<typeof getScraperProvider>["scrapeAnimeEpisodes"]>>;
}) {
  const normalizedEpisodes = scrapedEpisodes
    .filter((episode) => Number.isFinite(episode.number) && episode.number > 0 && episode.number <= 500)
    .map((episode) => ({
      ...episode,
      title: normalizeEpisodeTitle(episode.title, episode.number),
      thumbnail: normalizeEpisodeThumbnail(episode.thumbnail),
      synopsis: normalizeSynopsis(episode.synopsis),
    }));

  const desiredNumbers = Array.from(new Set(normalizedEpisodes.map((episode) => episode.number)));
  const existingEpisodes = await db.select().from(episodes).where(eq(episodes.animeId, animeId));
  const existingByNumber = new Map(existingEpisodes.map((episode) => [episode.number, episode] as const));

  const invalidNumbers = existingEpisodes
    .filter((episode) => episode.number <= 0 || episode.number > 500 || (desiredNumbers.length > 0 && !desiredNumbers.includes(episode.number)))
    .map((episode) => episode.id);

  if (invalidNumbers.length > 0) {
    await db.delete(episodes).where(inArray(episodes.id, invalidNumbers));
  }

  let addedEpisodes = 0;
  let updatedEpisodes = 0;

  for (const scrapedEpisode of normalizedEpisodes) {
    const existingEpisode = existingByNumber.get(scrapedEpisode.number);

    if (!existingEpisode) {
      await db.insert(episodes).values({
        animeId,
        number: scrapedEpisode.number,
        title: scrapedEpisode.title,
        synopsis: scrapedEpisode.synopsis || undefined,
        thumbnail: scrapedEpisode.thumbnail,
      });
      addedEpisodes++;
      continue;
    }

    await db
      .update(episodes)
      .set({
        title: scrapedEpisode.title || existingEpisode.title || `Episode ${scrapedEpisode.number}`,
        synopsis: scrapedEpisode.synopsis || existingEpisode.synopsis || undefined,
        thumbnail: scrapedEpisode.thumbnail ?? existingEpisode.thumbnail,
      })
      .where(eq(episodes.id, existingEpisode.id));
    updatedEpisodes++;
  }

  if (desiredNumbers.length > 0) {
    await db.update(anime).set({ episodesCount: desiredNumbers.length }).where(eq(anime.id, animeId));
  }

  const refreshedEpisodes = await db.select().from(episodes).where(eq(episodes.animeId, animeId));
  return {
    addedEpisodes,
    updatedEpisodes,
    currentEpisodes: refreshedEpisodes,
  };
}

export const scraperRouter = createRouter({
  scrapeAnime: adminQuery
    .input(z.object({ slug: z.string(), source: sourceSiteSchema.default("witanime") }))
    .mutation(async ({ input }) => {
      try {
        const provider = getScraperProvider(input.source);
        const scrapedData = await provider.scrapeAnimeInfo(input.slug);
        if (!scrapedData) {
          return { success: false, error: "Failed to scrape anime" };
        }
        const enrichedData = mergeScrapedAndEnrichedAnime(scrapedData, await enrichAnimeMetadata(scrapedData));

        const db = getDb();
        const scrapedEpisodes = await provider.scrapeAnimeEpisodes(input.slug);
        const result = await persistAnimeRecord({
          db,
          source: input.source,
          slug: input.slug,
          scrapedData: enrichedData,
          scrapedEpisodesCount: scrapedEpisodes.length,
        });

        return { success: true, ...result };
      } catch (err) {
        console.error("Error in scrapeAnime:", err);
        return { success: false, error: String(err) };
      }
    }),

  syncEpisodeSources: adminQuery
    .input(z.object({ episodeId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const episode = await db.select().from(episodes).where(eq(episodes.id, input.episodeId)).limit(1);

        if (!episode.length || !episode[0].animeId) {
          return { success: false, error: "Episode not found" };
        }

        const animeRecord = await db.select().from(anime).where(eq(anime.id, episode[0].animeId)).limit(1);
        if (!animeRecord.length || !animeRecord[0].externalSlug) {
          return { success: false, error: "Anime has no external slug" };
        }

        const provider = getScraperProvider(animeRecord[0].sourceSite ?? "witanime");
        const scrapedEpisodes = await provider.scrapeAnimeEpisodes(animeRecord[0].externalSlug);
        const scrapedEpisode = scrapedEpisodes.find((ep) => ep.number === episode[0].number);
        if (!scrapedEpisode) {
          return { success: false, error: "Could not match episode on source site" };
        }

        const sources = await provider.scrapeEpisodeSources(scrapedEpisode.id);
        if (sources.length === 0) {
          return { success: false, error: "No sources found" };
        }

        await db.update(episodes).set({ videoSources: sources }).where(eq(episodes.id, input.episodeId));
        return { success: true, sourcesCount: sources.length };
      } catch (err) {
        console.error("Error in syncEpisodeSources:", err);
        return { success: false, error: String(err) };
      }
    }),

  syncAllEpisodes: adminQuery
    .input(z.object({ animeId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const animeRecord = await db.select().from(anime).where(eq(anime.id, input.animeId)).limit(1);

        if (!animeRecord.length || !animeRecord[0].externalSlug) {
          return { success: false, error: "Anime has no external slug" };
        }

        const provider = getScraperProvider(animeRecord[0].sourceSite ?? "witanime");
        const scrapedEpisodes = await provider.scrapeAnimeEpisodes(animeRecord[0].externalSlug);
        const reconciled = await reconcileEpisodesForAnime({
          db,
          animeId: input.animeId,
          scrapedEpisodes,
        });
        const scrapedByNumber = new Map(scrapedEpisodes.map((ep) => [ep.number, ep] as const));
        const episodeList = reconciled.currentEpisodes.sort((a, b) => a.number - b.number);

        let synced = 0;
        let missing = 0;
        let failed = 0;

        for (const ep of episodeList) {
          try {
            const scrapedEpisode = scrapedByNumber.get(ep.number);
            if (!scrapedEpisode) {
              missing++;
              continue;
            }

            const sources = await withTimeout(
              provider.scrapeEpisodeSources(scrapedEpisode.id),
              15000,
              `Sync episode ${ep.number}`,
            );
            if (sources.length > 0) {
              await db.update(episodes).set({ videoSources: sources }).where(eq(episodes.id, ep.id));
              synced++;
            } else {
              failed++;
            }

            await new Promise((resolve) => setTimeout(resolve, 150));
          } catch (err) {
            console.error(`Failed to sync episode ${ep.number}:`, err);
            failed++;
          }
        }

        if (synced === 0) {
          return {
            success: false,
            error: failed > 0
              ? `No working sources were found. Failed ${failed} episodes${missing ? ` and missed ${missing}` : ""}.`
              : "No working sources were found.",
          };
        }

        return { success: true, syncedCount: synced, total: episodeList.length, missingCount: missing, failedCount: failed };
      } catch (err) {
        console.error("Error in syncAllEpisodes:", err);
        return { success: false, error: String(err) };
      }
    }),

  refreshAnimeMetadata: adminQuery
    .input(z.object({ animeId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const existingAnime = await db.select().from(anime).where(eq(anime.id, input.animeId)).limit(1);
        if (!existingAnime.length) {
          return { success: false, error: "Anime not found" };
        }

        const current = existingAnime[0];
        const source = current.sourceSite ?? "witanime";
        const provider = getScraperProvider(source);
        const scrapedData = current.externalSlug ? await provider.scrapeAnimeInfo(current.externalSlug) : null;

        const baseData: ScraperAnime = {
          slug: current.slug,
          title: current.title,
          titleJp: current.titleJp ?? undefined,
          synopsis: current.synopsis,
          coverImage: current.coverImage ?? undefined,
          bannerImage: current.bannerImage ?? undefined,
          status: current.status ?? "upcoming",
          type: current.type ?? "tv",
          episodesCount: current.episodesCount ?? 0,
          externalId: current.externalId ?? undefined,
          rating: current.rating ?? undefined,
          releaseYear: current.releaseYear ?? undefined,
          studio: current.studio ?? undefined,
          categoryName: undefined,
          duration: current.duration ?? undefined,
        };

        const mergedData = { ...baseData, ...(scrapedData ?? {}) };
        const enrichedData = mergeScrapedAndEnrichedAnime(mergedData, await enrichAnimeMetadata(mergedData));

        const result = await persistAnimeRecord({
          db,
          source,
          slug: current.slug,
          scrapedData: enrichedData,
          scrapedEpisodesCount: current.episodesCount ?? 0,
        });

        return { success: true, ...result };
      } catch (err) {
        console.error("Error in refreshAnimeMetadata:", err);
        return { success: false, error: String(err) };
      }
    }),

  getLatestFromSource: adminQuery
    .input(z.object({ source: sourceSiteSchema.default("witanime"), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      try {
        const provider = getScraperProvider(input.source);
        const latest = await provider.scrapeLatestAnime(input.limit);
        return { success: true, data: latest };
      } catch (err) {
        console.error("Error in getLatestFromSource:", err);
        return { success: false, error: String(err), data: [] };
      }
    }),

  searchSource: adminQuery
    .input(z.object({ source: sourceSiteSchema.default("witanime"), query: z.string() }))
    .query(async ({ input }) => {
      try {
        const provider = getScraperProvider(input.source);
        const results = await provider.searchAnime(input.query);
        return { success: true, data: results };
      } catch (err) {
        console.error("Error in searchSource:", err);
        return { success: false, error: String(err), data: [] };
      }
    }),

  importFromSource: adminQuery
    .input(z.object({ source: sourceSiteSchema.default("witanime"), slug: z.string(), importEpisodes: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const provider = getScraperProvider(input.source);
        const scrapedData = await provider.scrapeAnimeInfo(input.slug);
        if (!scrapedData) {
          return { success: false, error: "Failed to scrape anime info" };
        }
        const enrichedData = mergeScrapedAndEnrichedAnime(scrapedData, await enrichAnimeMetadata(scrapedData));

        const scrapedEpisodes = input.importEpisodes ? await provider.scrapeAnimeEpisodes(input.slug) : [];
        const persisted = await persistAnimeRecord({
          db,
          source: input.source,
          slug: input.slug,
          scrapedData: enrichedData,
          scrapedEpisodesCount: scrapedEpisodes.length,
        });
        const animeId = persisted.animeId;

        if (input.importEpisodes && scrapedEpisodes.length > 0) {
          const reconciled = await reconcileEpisodesForAnime({
            db,
            animeId,
            scrapedEpisodes,
          });

          return {
            success: true,
            animeId,
            action: persisted.action,
            episodesAdded: reconciled.addedEpisodes,
            episodesUpdated: reconciled.updatedEpisodes,
            episodesFound: scrapedEpisodes.length,
          };
        }

        return { success: true, animeId, action: persisted.action, episodesAdded: 0 };
      } catch (err) {
        console.error("Error in importFromSource:", err);
        return { success: false, error: String(err) };
      }
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
