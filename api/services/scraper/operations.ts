import { eq, inArray } from "drizzle-orm";
import {
  anime,
  animeGenres,
  categories,
  episodes,
  type Anime,
} from "@db/schema";
import { getDb } from "../../queries/connection";
import { storeImportedAnimeImage } from "../../lib/media-storage";
import { getScraperProvider } from "./provider-registry";
import { enrichAnimeMetadata } from "./metadata-enrichment";
import {
  inferExistingImageSource,
  resolveStoredImageSource,
  type ImageOrigin,
  type MetadataProviderSource,
  type StoredImageStorageKind,
} from "./media-provenance";
import type {
  ScraperAnime,
  ScraperEpisode,
  SourceSiteId,
} from "./types";

type Db = ReturnType<typeof getDb>;

type PersistOptions = {
  downloadImages?: boolean;
};

type DownloadedImageResult = {
  url: string;
  storage: StoredImageStorageKind;
};

export type ScraperActionResult =
  | {
      success: true;
      animeId: number;
      action: "created" | "updated";
      episodesAdded?: number;
      episodesUpdated?: number;
      episodesFound?: number;
    }
  | {
      success: false;
      error: string;
    };

export type SyncAllEpisodesResult =
  | {
      success: true;
      syncedCount: number;
      total: number;
      missingCount: number;
      failedCount: number;
    }
  | {
      success: false;
      error: string;
    };

export type SyncEpisodeSourcesResult =
  | {
      success: true;
      sourcesCount: number;
    }
  | {
      success: false;
      error: string;
    };

function normalizeStoredSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

async function downloadImage(
  url: string,
  slug: string
): Promise<DownloadedImageResult | null> {
  if (!url || !url.startsWith("http")) return null;

  try {
    const response = await fetch(url);
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1024) return null;

    return await storeImportedAnimeImage({
      slug,
      sourceUrl: url,
      contentType,
      buffer: Buffer.from(buffer),
    });
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

function normalizeCategoryNames(categoryName?: string) {
  if (!categoryName) return [];

  return Array.from(
    new Set(
      categoryName
        .split(/\||,|ØŒ|\//)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((part) => part.slice(0, 100))
    )
  );
}

function humanizeSlug(slug: string) {
  return normalizeStoredSlug(slug)
    .replace(/^anime\//i, "")
    .replace(/^Ø§Ù†Ù…ÙŠ-?/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function normalizeTitle(title: string | undefined, slug: string) {
  const cleaned = (title ?? "").replace(/\s+/g, " ").trim();
  if (
    !cleaned ||
    ["risto", "ØªØµÙØ­", "unknown"].includes(cleaned.toLowerCase())
  ) {
    return humanizeSlug(slug);
  }

  return cleaned.slice(0, 255);
}

function normalizeTitleSynonyms(values?: string[]) {
  if (!values?.length) return undefined;

  const normalized = Array.from(
    new Set(
      values
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 255))
    )
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSynopsis(synopsis?: string) {
  if (!synopsis) return "";

  const cleaned = synopsis
    .replace(/\s+/g, " ")
    .replace(/\{"prefetch":.*$/i, "")
    .replace(/Ø¹ÙˆØ¯Ø© Ø§Ù„Ù‰ Ø£Ø¹Ù„ÙŠ.*$/i, "")
    .trim();

  return cleaned.slice(0, 4000);
}

function normalizeStudio(studio?: string) {
  if (!studio) return undefined;
  const cleaned = studio.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 100) : undefined;
}

function normalizeDuration(duration?: number) {
  if (
    !duration ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 400
  ) {
    return undefined;
  }

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
  existingStatus?: ScraperAnime["status"] | null
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
  if (
    cleaned.startsWith("/anime-covers/") ||
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://")
  ) {
    return cleaned;
  }

  return null;
}

function choosePreferredImage(
  primary?: string | null,
  fallback?: string | null
) {
  return normalizeImagePath(primary) ?? normalizeImagePath(fallback) ?? null;
}

function determineImageOrigin(
  scrapedValue: string | undefined,
  enrichmentValue: string | undefined
): ImageOrigin {
  if (!enrichmentValue) return "source";
  if (!scrapedValue) return "metadata";
  return enrichmentValue !== scrapedValue ? "metadata" : "source";
}

function resolveMetadataSource(input: {
  currentSource?: MetadataProviderSource | "none" | null;
  existingSource?: string | null;
}) {
  if (input.currentSource && input.currentSource !== "none") {
    return input.currentSource;
  }

  return input.existingSource ?? "source_site";
}

function normalizeEpisodeTitle(
  title: string | undefined,
  episodeNumber: number
) {
  const cleaned = (title ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return `Episode ${episodeNumber}`;
  return cleaned.slice(0, 255);
}

function normalizeEpisodeThumbnail(thumbnail?: string) {
  if (!thumbnail) return undefined;
  const cleaned = thumbnail.trim();
  return cleaned || undefined;
}

async function ensureCategoryIds(db: Db, categoryName?: string) {
  const normalizedNames = normalizeCategoryNames(categoryName);
  const categoryIds: number[] = [];

  for (const normalizedName of normalizedNames) {
    const existingCat = await db
      .select()
      .from(categories)
      .where(eq(categories.name, normalizedName))
      .limit(1);
    if (existingCat.length > 0) {
      categoryIds.push(existingCat[0].id);
      continue;
    }

    const slug = toCategorySlug(normalizedName) || `category-${Date.now()}`;
    const [newCat] = await db
      .insert(categories)
      .values({ name: normalizedName, slug })
      .returning({ id: categories.id });
    categoryIds.push(newCat.id);
  }

  return categoryIds;
}

async function syncAnimeGenreLinks(
  db: Db,
  animeId: number,
  categoryIds: number[]
) {
  await db.delete(animeGenres).where(eq(animeGenres.animeId, animeId));

  if (categoryIds.length === 0) return;

  await db.insert(animeGenres).values(
    categoryIds.map((categoryId) => ({
      animeId,
      categoryId,
    }))
  );
}

function toScoreValue(rating?: string) {
  if (!rating) return "0.00";
  const numeric = Number.parseFloat(
    rating.replace(",", ".").match(/\d+(\.\d+)?/)?.[0] ?? ""
  );
  if (Number.isNaN(numeric)) return "0.00";
  return Math.min(10, Math.max(0, numeric)).toFixed(2);
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mergeScrapedAndEnrichedAnime(
  siteData: ScraperAnime,
  enrichedData: Partial<ScraperAnime>
): ScraperAnime {
  return {
    ...siteData,
    ...enrichedData,
    synopsis:
      normalizeSynopsis(siteData.synopsis) ||
      normalizeSynopsis(enrichedData.synopsis) ||
      "",
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
  metadataSource,
  coverImageOrigin,
  bannerImageOrigin,
  options,
}: {
  db: Db;
  source: SourceSiteId;
  slug: string;
  scrapedData: ScraperAnime;
  metadataSource: MetadataProviderSource | "none";
  coverImageOrigin: ImageOrigin;
  bannerImageOrigin: ImageOrigin;
  options?: PersistOptions;
}) {
  const normalizedSlug = normalizeStoredSlug(slug);
  const existingAnime = await db
    .select()
    .from(anime)
    .where(eq(anime.slug, normalizedSlug))
    .limit(1);
  const categoryIds = await ensureCategoryIds(db, scrapedData.categoryName);
  const categoryId = categoryIds[0];
  const shouldDownloadImages = options?.downloadImages ?? true;

  let downloadedCoverImage: DownloadedImageResult | null = null;
  if (shouldDownloadImages && scrapedData.coverImage?.startsWith("http")) {
    downloadedCoverImage = await downloadImage(scrapedData.coverImage, normalizedSlug);
  }

  const candidateCoverImage = downloadedCoverImage?.url ?? scrapedData.coverImage ?? null;

  let downloadedBannerImage: DownloadedImageResult | null = null;
  if (
    shouldDownloadImages &&
    scrapedData.bannerImage?.startsWith("http") &&
    scrapedData.bannerImage !== scrapedData.coverImage
  ) {
    downloadedBannerImage = await downloadImage(
      scrapedData.bannerImage,
      `${normalizedSlug}-banner`
    );
  }

  const candidateBannerImage =
    downloadedBannerImage?.url ??
    scrapedData.bannerImage ??
    candidateCoverImage ??
    null;

  const existing = existingAnime[0];
  const normalizedTitle = normalizeTitle(scrapedData.title, normalizedSlug);
  const normalizedTitleEnglish = scrapedData.titleEnglish
    ? normalizeTitle(scrapedData.titleEnglish, normalizedSlug)
    : (existing?.titleEnglish ?? undefined);
  const normalizedTitleSynonyms =
    normalizeTitleSynonyms(scrapedData.titleSynonyms) ??
    existing?.titleSynonyms ??
    undefined;
  const normalizedSynopsis = normalizeSynopsis(scrapedData.synopsis);
  const normalizedRating = normalizeRating(scrapedData.rating);
  const normalizedStudio = normalizeStudio(scrapedData.studio);
  const normalizedReleaseYear = normalizeReleaseYear(scrapedData.releaseYear);
  const normalizedDuration = normalizeDuration(scrapedData.duration);
  const normalizedEpisodesCount = Math.min(scrapedData.episodesCount, 500);
  const normalizedStatus = inferAnimeStatus(
    scrapedData.status,
    normalizedEpisodesCount,
    existing?.status ?? undefined
  );
  const clearStaleAnimeOnlyMetadata =
    source === "stardima" &&
    !scrapedData.externalId &&
    !scrapedData.titleJp &&
    !normalizeTitleSynonyms(scrapedData.titleSynonyms);

  const nextCoverImage = choosePreferredImage(candidateCoverImage, existing?.coverImage);
  const nextCoverImageSource = resolveStoredImageSource({
    origin: coverImageOrigin,
    finalUrl: nextCoverImage,
    storedStorageKind: downloadedCoverImage?.storage,
    existingUrl: existing?.coverImage,
    existingSource:
      existing?.coverImageSource ?? inferExistingImageSource(existing?.coverImage),
  });
  const nextBannerImage =
    choosePreferredImage(
      candidateBannerImage,
      clearStaleAnimeOnlyMetadata ? null : existing?.bannerImage
    ) ?? nextCoverImage;
  const nextBannerImageSource = resolveStoredImageSource({
    origin: bannerImageOrigin,
    finalUrl: nextBannerImage,
    storedStorageKind: downloadedBannerImage?.storage,
    existingUrl: existing?.bannerImage,
    existingSource:
      existing?.bannerImageSource ?? inferExistingImageSource(existing?.bannerImage),
    fallbackSource: nextBannerImage === nextCoverImage ? nextCoverImageSource : null,
  });

  const payload = {
    title: normalizedTitle,
    titleEnglish: normalizedTitleEnglish,
    titleJp:
      scrapedData.titleJp ??
      (clearStaleAnimeOnlyMetadata ? null : (existing?.titleJp ?? undefined)),
    titleSynonyms: clearStaleAnimeOnlyMetadata ? null : normalizedTitleSynonyms,
    synopsis: normalizedSynopsis || existing?.synopsis || "",
    coverImage: nextCoverImage,
    coverImageSource: nextCoverImageSource,
    bannerImage: nextBannerImage,
    bannerImageSource: nextBannerImageSource,
    metadataSource: resolveMetadataSource({
      currentSource: metadataSource,
      existingSource: clearStaleAnimeOnlyMetadata ? null : existing?.metadataSource,
    }),
    status: normalizedStatus,
    type: scrapedData.type,
    episodesCount: normalizedEpisodesCount,
    externalId:
      scrapedData.externalId ??
      (clearStaleAnimeOnlyMetadata
        ? null
        : (existing?.externalId ?? undefined)),
    externalSlug: normalizedSlug,
    sourceSite: source,
    lastScrapedAt: new Date(),
    rating:
      normalizedRating ??
      (clearStaleAnimeOnlyMetadata ? null : (existing?.rating ?? undefined)),
    releaseYear: normalizedReleaseYear ?? existing?.releaseYear ?? undefined,
    studio:
      normalizedStudio ??
      (clearStaleAnimeOnlyMetadata ? null : (existing?.studio ?? undefined)),
    duration: normalizedDuration ?? existing?.duration ?? undefined,
    score: normalizedRating
      ? toScoreValue(normalizedRating)
      : clearStaleAnimeOnlyMetadata
        ? "0.00"
        : (existing?.score ?? "0.00"),
    categoryId,
  } as const;

  if (existingAnime.length > 0) {
    await db
      .update(anime)
      .set(payload)
      .where(eq(anime.id, existingAnime[0].id));
    await syncAnimeGenreLinks(db, existingAnime[0].id, categoryIds);
    return { animeId: existingAnime[0].id, action: "updated" as const };
  }

  const [inserted] = await db
    .insert(anime)
    .values({
      ...payload,
      slug: normalizedSlug,
    })
    .returning({ id: anime.id });

  await syncAnimeGenreLinks(db, inserted.id, categoryIds);

  return { animeId: inserted.id, action: "created" as const };
}

async function reconcileEpisodesForAnime({
  db,
  animeId,
  scrapedEpisodes,
}: {
  db: Db;
  animeId: number;
  scrapedEpisodes: ScraperEpisode[];
}) {
  const normalizedEpisodes = scrapedEpisodes
    .filter(
      (episode) =>
        Number.isFinite(episode.number) &&
        episode.number > 0 &&
        episode.number <= 500
    )
    .map((episode) => ({
      ...episode,
      title: normalizeEpisodeTitle(episode.title, episode.number),
      thumbnail: normalizeEpisodeThumbnail(episode.thumbnail),
      synopsis: normalizeSynopsis(episode.synopsis),
    }));

  const desiredNumbers = Array.from(
    new Set(normalizedEpisodes.map((episode) => episode.number))
  );
  const existingEpisodes = await db
    .select()
    .from(episodes)
    .where(eq(episodes.animeId, animeId));
  const existingByNumber = new Map(
    existingEpisodes.map((episode) => [episode.number, episode] as const)
  );

  const invalidNumbers = existingEpisodes
    .filter(
      (episode) =>
        episode.number <= 0 ||
        episode.number > 500 ||
        (desiredNumbers.length > 0 && !desiredNumbers.includes(episode.number))
    )
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
        title:
          scrapedEpisode.title ||
          existingEpisode.title ||
          `Episode ${scrapedEpisode.number}`,
        synopsis:
          scrapedEpisode.synopsis || existingEpisode.synopsis || undefined,
        thumbnail: scrapedEpisode.thumbnail ?? existingEpisode.thumbnail,
      })
      .where(eq(episodes.id, existingEpisode.id));
    updatedEpisodes++;
  }

  if (desiredNumbers.length > 0) {
    await db
      .update(anime)
      .set({ episodesCount: desiredNumbers.length })
      .where(eq(anime.id, animeId));
  }

  const refreshedEpisodes = await db
    .select()
    .from(episodes)
    .where(eq(episodes.animeId, animeId));
  return {
    addedEpisodes,
    updatedEpisodes,
    currentEpisodes: refreshedEpisodes,
  };
}

export async function runScrapeAnimeOperation(input: {
  source: SourceSiteId;
  slug: string;
  db?: Db;
  options?: PersistOptions;
}): Promise<ScraperActionResult> {
  const db = input.db ?? getDb();

  const provider = getScraperProvider(input.source);
  const scrapedData = await provider.scrapeAnimeInfo(input.slug);
  if (!scrapedData) {
    return { success: false, error: "Failed to scrape anime" };
  }

  const enrichment = await enrichAnimeMetadata(scrapedData);
  const enrichedData = mergeScrapedAndEnrichedAnime(
    scrapedData,
    enrichment.data
  );
  const scrapedEpisodes = await provider.scrapeAnimeEpisodes(input.slug);
  const result = await persistAnimeRecord({
    db,
    source: input.source,
    slug: input.slug,
    scrapedData: enrichedData,
    metadataSource: enrichment.source,
    coverImageOrigin: determineImageOrigin(
      scrapedData.coverImage,
      enrichment.data.coverImage
    ),
    bannerImageOrigin: determineImageOrigin(
      scrapedData.bannerImage,
      enrichment.data.bannerImage
    ),
    options: input.options,
  });

  await db
    .update(anime)
    .set({ episodesCount: Math.min(scrapedEpisodes.length, 500) })
    .where(eq(anime.id, result.animeId));

  return { success: true, ...result };
}

export async function runImportFromSourceOperation(input: {
  source: SourceSiteId;
  slug: string;
  importEpisodes: boolean;
  db?: Db;
  options?: PersistOptions;
}): Promise<ScraperActionResult> {
  const db = input.db ?? getDb();
  const provider = getScraperProvider(input.source);
  const scrapedData = await provider.scrapeAnimeInfo(input.slug);
  if (!scrapedData) {
    return { success: false, error: "Failed to scrape anime info" };
  }

  const canonicalSlug = normalizeStoredSlug(scrapedData.slug || input.slug);
  const enrichment = await enrichAnimeMetadata(scrapedData);
  const enrichedData = mergeScrapedAndEnrichedAnime(
    scrapedData,
    enrichment.data
  );

  const scrapedEpisodes = input.importEpisodes
    ? await provider.scrapeAnimeEpisodes(canonicalSlug)
    : [];

  if (input.importEpisodes && scrapedEpisodes.length === 0) {
    return {
      success: false,
      error: `No episodes were found on ${input.source} for "${canonicalSlug}".`,
    };
  }

  const persisted = await persistAnimeRecord({
    db,
    source: input.source,
    slug: canonicalSlug,
    scrapedData: {
      ...enrichedData,
      episodesCount: scrapedEpisodes.length || enrichedData.episodesCount,
    },
    metadataSource: enrichment.source,
    coverImageOrigin: determineImageOrigin(
      scrapedData.coverImage,
      enrichment.data.coverImage
    ),
    bannerImageOrigin: determineImageOrigin(
      scrapedData.bannerImage,
      enrichment.data.bannerImage
    ),
    options: input.options,
  });

  if (input.importEpisodes && scrapedEpisodes.length > 0) {
    const reconciled = await reconcileEpisodesForAnime({
      db,
      animeId: persisted.animeId,
      scrapedEpisodes,
    });

    return {
      success: true,
      animeId: persisted.animeId,
      action: persisted.action,
      episodesAdded: reconciled.addedEpisodes,
      episodesUpdated: reconciled.updatedEpisodes,
      episodesFound: scrapedEpisodes.length,
    };
  }

  return {
    success: true,
    animeId: persisted.animeId,
    action: persisted.action,
    episodesAdded: 0,
  };
}

export async function runRefreshAnimeMetadataOperation(input: {
  animeId: number;
  db?: Db;
  options?: PersistOptions;
}): Promise<ScraperActionResult> {
  const db = input.db ?? getDb();
  const existingAnime = await db
    .select()
    .from(anime)
    .where(eq(anime.id, input.animeId))
    .limit(1);

  if (!existingAnime.length) {
    return { success: false, error: "Anime not found" };
  }

  const current = existingAnime[0];
  const source = current.sourceSite ?? "witanime";
  const provider = getScraperProvider(source);
  const scrapedData = current.externalSlug
    ? await provider.scrapeAnimeInfo(current.externalSlug)
    : null;

  const baseData: ScraperAnime = {
    slug: current.slug,
    title: current.title,
    titleEnglish: current.titleEnglish ?? undefined,
    titleJp: current.titleJp ?? undefined,
    titleSynonyms: current.titleSynonyms ?? undefined,
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
  const enrichment = await enrichAnimeMetadata(mergedData);
  const enrichedData = mergeScrapedAndEnrichedAnime(
    mergedData,
    enrichment.data
  );

  const result = await persistAnimeRecord({
    db,
    source,
    slug: current.slug,
    scrapedData: {
      ...enrichedData,
      episodesCount: current.episodesCount ?? enrichedData.episodesCount,
    },
    metadataSource: enrichment.source,
    coverImageOrigin: determineImageOrigin(
      mergedData.coverImage,
      enrichment.data.coverImage
    ),
    bannerImageOrigin: determineImageOrigin(
      mergedData.bannerImage,
      enrichment.data.bannerImage
    ),
    options: input.options,
  });

  return { success: true, ...result };
}

export async function runSyncEpisodeSourcesOperation(input: {
  episodeId: number;
  db?: Db;
}): Promise<SyncEpisodeSourcesResult> {
  const db = input.db ?? getDb();
  const episode = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, input.episodeId))
    .limit(1);

  if (!episode.length || !episode[0].animeId) {
    return { success: false, error: "Episode not found" };
  }

  const animeRecord = await db
    .select()
    .from(anime)
    .where(eq(anime.id, episode[0].animeId))
    .limit(1);
  if (!animeRecord.length || !animeRecord[0].externalSlug) {
    return { success: false, error: "Anime has no external slug" };
  }

  const provider = getScraperProvider(animeRecord[0].sourceSite ?? "witanime");
  const scrapedEpisodes = await provider.scrapeAnimeEpisodes(
    animeRecord[0].externalSlug
  );
  const scrapedEpisode = scrapedEpisodes.find(
    (ep) => ep.number === episode[0].number
  );
  if (!scrapedEpisode) {
    return {
      success: false,
      error: "Could not match episode on source site",
    };
  }

  const sources = await provider.scrapeEpisodeSources(scrapedEpisode.id);
  if (sources.length === 0) {
    return { success: false, error: "No sources found" };
  }

  await db
    .update(episodes)
    .set({ videoSources: sources })
    .where(eq(episodes.id, input.episodeId));

  return { success: true, sourcesCount: sources.length };
}

export async function runSyncAllEpisodesOperation(input: {
  animeId: number;
  db?: Db;
}): Promise<SyncAllEpisodesResult> {
  const db = input.db ?? getDb();
  const animeRecord = await db
    .select()
    .from(anime)
    .where(eq(anime.id, input.animeId))
    .limit(1);

  if (!animeRecord.length || !animeRecord[0].externalSlug) {
    return { success: false, error: "Anime has no external slug" };
  }

  const provider = getScraperProvider(animeRecord[0].sourceSite ?? "witanime");
  const scrapedEpisodes = await provider.scrapeAnimeEpisodes(
    animeRecord[0].externalSlug
  );
  const reconciled = await reconcileEpisodesForAnime({
    db,
    animeId: input.animeId,
    scrapedEpisodes,
  });
  const scrapedByNumber = new Map(
    scrapedEpisodes.map((ep) => [ep.number, ep] as const)
  );
  const episodeList = reconciled.currentEpisodes.sort(
    (a, b) => a.number - b.number
  );

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
        `Sync episode ${ep.number}`
      );
      if (sources.length > 0) {
        await db
          .update(episodes)
          .set({ videoSources: sources })
          .where(eq(episodes.id, ep.id));
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
      error:
        failed > 0
          ? `No working sources were found. Failed ${failed} episodes${missing ? ` and missed ${missing}` : ""}.`
          : "No working sources were found.",
    };
  }

  return {
    success: true,
    syncedCount: synced,
    total: episodeList.length,
    missingCount: missing,
    failedCount: failed,
  };
}

export function buildAnimeMetadataFromRecord(current: Anime): ScraperAnime {
  return {
    slug: current.slug,
    title: current.title,
    titleEnglish: current.titleEnglish ?? undefined,
    titleJp: current.titleJp ?? undefined,
    titleSynonyms: current.titleSynonyms ?? undefined,
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
}
