import { z } from "zod";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { anime, animeGenres, categories } from "@db/schema";
import { SOURCE_SITE_IDS } from "./services/scraper/types";
import { normalizeSearchText, scoreAnimeSearch } from "./lib/anime-search";
import {
  deleteAdminAnimeById,
  deleteAdminAnimeByIds,
} from "./services/admin-anime-service";

const sourceSiteSchema = z.enum(SOURCE_SITE_IDS);

function normalizeRouteSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

const animeListInput = z.object({
  category: z.string().optional(),
  status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
  type: z.enum(["tv", "movie", "ova", "special"]).optional(),
  releaseYear: z.number().int().optional(),
  search: z.string().optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
}).optional();

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
  db: ReturnType<typeof getDb>,
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

export const animeRouter = createRouter({
  list: publicQuery
    .input(animeListInput)
    .query(async ({ input }) => {
      const db = getDb();
      const categorySlug = input?.category;

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
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
          ? (
              categoryAnimeIds && categoryAnimeIds.length > 0
                ? inArray(anime.id, categoryAnimeIds)
                : sql`1 = 0`
            )
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
      };
    }),

  featured: publicQuery.query(async () => {
    const db = getDb();
    const items = await db
      .select(animeSelection)
      .from(anime)
      .where(eq(anime.featured, true))
      .orderBy(desc(anime.createdAt))
      .limit(6);
    return attachGenres(db, items);
  }),

  trending: publicQuery.query(async () => {
    const db = getDb();
    const items = await db
      .select(animeSelection)
      .from(anime)
      .orderBy(desc(anime.score))
      .limit(8);
    return attachGenres(db, items);
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const normalizedSlug = normalizeRouteSlug(input.slug);
      const results = await db
        .select(animeSelection)
        .from(anime)
        .where(or(eq(anime.slug, normalizedSlug), eq(anime.slug, `${normalizedSlug}/`)))
        .limit(1);
      const [result] = await attachGenres(db, results);
      return result ?? null;
    }),

  create: adminQuery
    .input(
      z.object({
        title: z.string().min(1),
        titleJp: z.string().optional(),
        slug: z.string().min(1),
        synopsis: z.string().min(1),
        coverImage: z.string().optional(),
        bannerImage: z.string().optional(),
        status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
        type: z.enum(["tv", "movie", "ova", "special"]).optional(),
        rating: z.string().optional(),
        releaseYear: z.number().optional(),
        studio: z.string().optional(),
        categoryId: z.number().optional(),
        duration: z.number().optional(),
        featured: z.boolean().optional(),
        sourceSite: sourceSiteSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [inserted] = await db.insert(anime).values(input).returning({ id: anime.id });
      const id = inserted.id;
      const results = await db.select().from(anime).where(eq(anime.id, id));
      return results[0];
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        titleJp: z.string().optional(),
        slug: z.string().min(1).optional(),
        synopsis: z.string().min(1).optional(),
        coverImage: z.string().optional(),
        bannerImage: z.string().optional(),
        status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
        type: z.enum(["tv", "movie", "ova", "special"]).optional(),
        rating: z.string().optional(),
        releaseYear: z.number().optional(),
        studio: z.string().optional(),
        categoryId: z.number().optional(),
        duration: z.number().optional(),
        featured: z.boolean().optional(),
        sourceSite: sourceSiteSchema.optional(),
        score: z.string().optional(),
        episodesCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(anime).set(data).where(eq(anime.id, id));
      const results = await db.select().from(anime).where(eq(anime.id, id));
      return results[0];
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return deleteAdminAnimeById(input.id);
    }),

  bulkDelete: adminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      return deleteAdminAnimeByIds(input.ids);
    }),
});
