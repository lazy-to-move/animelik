import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { anime, animeGenres, categories, episodes } from "@db/schema";
import { getDb } from "../queries/connection";
import { normalizeSearchText, scoreAnimeSearch } from "../lib/anime-search";
import { listReviewsForAnime } from "./review-service";

type Db = ReturnType<typeof getDb>;

export type PublicAnimeListFilters = {
  category?: string;
  status?: "ongoing" | "completed" | "upcoming";
  type?: "tv" | "movie" | "ova" | "special";
  releaseYear?: number;
  search?: string;
  page?: number;
  limit?: number;
};

function normalizeRouteSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

const animeSelection = {
  id: anime.id,
  title: anime.title,
  titleEnglish: anime.titleEnglish,
  titleJp: anime.titleJp,
  titleSynonyms: anime.titleSynonyms,
  slug: anime.slug,
  synopsis: anime.synopsis,
  coverImage: anime.coverImage,
  coverImageSource: anime.coverImageSource,
  bannerImage: anime.bannerImage,
  bannerImageSource: anime.bannerImageSource,
  metadataSource: anime.metadataSource,
  status: anime.status,
  type: anime.type,
  rating: anime.rating,
  releaseYear: anime.releaseYear,
  studio: anime.studio,
  score: anime.score,
  episodesCount: anime.episodesCount,
  duration: anime.duration,
  featured: anime.featured,
  categoryId: anime.categoryId,
  externalId: anime.externalId,
  externalSlug: anime.externalSlug,
  sourceSite: anime.sourceSite,
  broadcastDay: anime.broadcastDay,
  broadcastTime: anime.broadcastTime,
  broadcastTimezone: anime.broadcastTimezone,
  broadcastText: anime.broadcastText,
  broadcastFetchedAt: anime.broadcastFetchedAt,
  lastScrapedAt: anime.lastScrapedAt,
  createdAt: anime.createdAt,
  updatedAt: anime.updatedAt,
} as const;

type AnimeListItem = typeof anime.$inferSelect & {
  titleEnglish: string | null;
  titleJp: string | null;
  titleSynonyms: string[] | null;
  slug: string;
  releaseYear: number | null;
  score: string | null;
};

async function attachGenres<T extends { id: number; categoryId: number | null }>(
  db: Db,
  items: T[],
) {
  if (items.length === 0) {
    return items.map((item) => ({
      ...item,
      genres: [] as string[],
      genreNames: "",
      categoryName: undefined as string | undefined,
    }));
  }

  const animeIds = items.map((item) => item.id);
  const fallbackCategoryIds = Array.from(
    new Set(items.map((item) => item.categoryId).filter((value): value is number => value !== null)),
  );
  const fallbackCategories = fallbackCategoryIds.length === 0
    ? []
    : await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(inArray(categories.id, fallbackCategoryIds));
  const fallbackCategoryMap = new Map(fallbackCategories.map((category) => [category.id, category.name] as const));

  const genreRows = await db
    .select({
      animeId: animeGenres.animeId,
      categoryName: categories.name,
      categoryId: categories.id,
    })
    .from(animeGenres)
    .innerJoin(categories, eq(animeGenres.categoryId, categories.id))
    .where(inArray(animeGenres.animeId, animeIds))
    .catch(() => []);

  const genreMap = new Map<number, Array<{ id: number; name: string }>>();
  for (const row of genreRows) {
    const existing = genreMap.get(row.animeId) ?? [];
    existing.push({ id: row.categoryId, name: row.categoryName });
    genreMap.set(row.animeId, existing);
  }

  return items.map((item) => {
    const genres = genreMap.get(item.id) ?? [];
    const uniqueNames = Array.from(new Set(genres.map((genre) => genre.name)));
    const primaryCategory =
      genres.find((genre) => genre.id === item.categoryId)?.name ??
      (item.categoryId ? fallbackCategoryMap.get(item.categoryId) : undefined) ??
      uniqueNames[0];
    const allGenreNames = primaryCategory && !uniqueNames.includes(primaryCategory)
      ? [primaryCategory, ...uniqueNames]
      : uniqueNames;

    return {
      ...item,
      genres: allGenreNames,
      genreNames: allGenreNames.join(" • "),
      categoryName: primaryCategory,
    };
  });
}

export async function listPublicAnime(input?: PublicAnimeListFilters) {
  const db = getDb();
  const categorySlug = input?.category;
  const page = input?.page ?? 1;
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  let categoryAnimeIds: number[] | undefined;

  if (categorySlug) {
    const categoryRows = await db
      .select({ animeId: animeGenres.animeId })
      .from(animeGenres)
      .innerJoin(categories, eq(animeGenres.categoryId, categories.id))
      .where(eq(categories.slug, categorySlug))
      .catch(() =>
        db
          .select({ animeId: anime.id })
          .from(anime)
          .innerJoin(categories, eq(anime.categoryId, categories.id))
          .where(eq(categories.slug, categorySlug)),
      );

    categoryAnimeIds = categoryRows.map((row) => row.animeId);
  }

  const filters = [
    categorySlug
      ? categoryAnimeIds && categoryAnimeIds.length > 0
        ? inArray(anime.id, categoryAnimeIds)
        : sql`1 = 0`
      : undefined,
    input?.status ? eq(anime.status, input.status) : undefined,
    input?.type ? eq(anime.type, input.type) : undefined,
    input?.releaseYear ? eq(anime.releaseYear, input.releaseYear) : undefined,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const normalizedSearch = normalizeSearchText(input?.search);

  let items: AnimeListItem[];
  let total = 0;

  if (normalizedSearch) {
    const baseItems = await db
      .select(animeSelection)
      .from(anime)
      .where(whereClause)
      .orderBy(desc(anime.createdAt));

    const matchedItems = baseItems
      .map((item) => ({
        item,
        score: scoreAnimeSearch(item, normalizedSearch),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) =>
        right.score - left.score ||
        Number(right.item.score ?? 0) - Number(left.item.score ?? 0) ||
        Number(right.item.releaseYear ?? 0) - Number(left.item.releaseYear ?? 0),
      )
      .map((entry) => entry.item);

    total = matchedItems.length;
    items = matchedItems.slice(offset, offset + limit);
  } else {
    items = await db
      .select(animeSelection)
      .from(anime)
      .where(whereClause)
      .orderBy(desc(anime.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(anime)
      .where(whereClause);

    total = countResult?.count ?? 0;
  }

  return {
    items: await attachGenres(db, items),
    total,
    page,
    limit,
  };
}

export async function getFeaturedPublicAnime(limit = 6) {
  const db = getDb();
  const items = await db
    .select(animeSelection)
    .from(anime)
    .where(eq(anime.featured, true))
    .orderBy(desc(anime.createdAt))
    .limit(limit);
  return attachGenres(db, items);
}

export async function getTrendingPublicAnime(limit = 8) {
  const db = getDb();
  const items = await db
    .select(animeSelection)
    .from(anime)
    .orderBy(desc(anime.score))
    .limit(limit);
  return attachGenres(db, items);
}

export async function getPublicAnimeBySlug(slug: string) {
  const db = getDb();
  const normalizedSlug = normalizeRouteSlug(slug);
  const results = await db
    .select(animeSelection)
    .from(anime)
    .where(or(eq(anime.slug, normalizedSlug), eq(anime.slug, `${normalizedSlug}/`)))
    .limit(1);

  const [result] = await attachGenres(db, results);
  return result ?? null;
}

export async function getPublicAnimeDetails(slug: string) {
  const db = getDb();
  const animeRecord = await getPublicAnimeBySlug(slug);
  if (!animeRecord) return null;

  const episodeList = await db
    .select()
    .from(episodes)
    .where(eq(episodes.animeId, animeRecord.id))
    .orderBy(episodes.number);

  const reviewList = await listReviewsForAnime(animeRecord.id);

  return {
    anime: animeRecord,
    episodes: episodeList,
    reviews: reviewList,
  };
}
