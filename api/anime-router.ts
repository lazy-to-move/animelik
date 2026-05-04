import { z } from "zod";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { anime, animeGenres, categories, episodes, reviews, watchlist } from "@db/schema";
import { SOURCE_SITE_IDS } from "./services/scraper/types";

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
  bannerImage: anime.bannerImage,
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

function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function buildSearchAliases(item: Pick<AnimeListItem, "title" | "titleEnglish" | "titleJp" | "titleSynonyms" | "slug">) {
  const aliases = new Set<string>();
  const rawValues = [
    item.title,
    item.titleEnglish,
    item.titleJp,
    ...(item.titleSynonyms ?? []),
    item.slug.replace(/-/g, " "),
  ];

  for (const rawValue of rawValues) {
    const normalized = normalizeSearchText(rawValue);
    if (!normalized) continue;

    aliases.add(normalized);

    const compact = normalized.replace(/\s+/g, " ");
    if (compact !== normalized) {
      aliases.add(compact);
    }

    for (const part of normalized.split(/\s{2,}|[/:|]/)) {
      const trimmed = normalizeSearchText(part);
      if (trimmed) aliases.add(trimmed);
    }
  }

  return Array.from(aliases);
}

function scoreAnimeSearch(
  item: Pick<AnimeListItem, "title" | "titleEnglish" | "titleJp" | "titleSynonyms" | "slug">,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const aliases = buildSearchAliases(item);
  let bestScore = 0;

  for (const alias of aliases) {
    if (alias === normalizedQuery) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (alias.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 92);
    }

    if (alias.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 88);
    }

    const aliasTokens = alias.split(" ").filter((token) => token.length >= 3);
    const matchedTokens = queryTokens.filter((token) =>
      token.length >= 3 &&
      aliasTokens.some((aliasToken) => {
        if (aliasToken === token) return true;
        if (token.length >= 5 && aliasToken.startsWith(token)) return true;
        if (aliasToken.length >= 5 && token.startsWith(aliasToken)) return true;
        return false;
      }),
    ).length;

    if (matchedTokens > 0) {
      bestScore = Math.max(bestScore, 60 + matchedTokens * 8);
    }

    if (queryTokens.length === 1) {
      for (const aliasToken of aliasTokens) {
        const distance = levenshteinDistance(queryTokens[0], aliasToken);
        if (distance <= 2) {
          bestScore = Math.max(bestScore, 72 - distance * 8);
        }
      }
    } else {
      const compactAlias = alias.replace(/\s+/g, "");
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      const distance = levenshteinDistance(compactQuery, compactAlias);
      const allowedDistance = compactQuery.length >= 10 ? 3 : 2;
      if (distance <= allowedDistance) {
        bestScore = Math.max(bestScore, 70 - distance * 6);
      }
    }
  }

  return bestScore;
}

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
      const [inserted] = await db.insert(anime).values(input).$returningId();
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
      const db = getDb();
      await db.delete(episodes).where(eq(episodes.animeId, input.id));
      await db.delete(reviews).where(eq(reviews.animeId, input.id));
      await db.delete(watchlist).where(eq(watchlist.animeId, input.id));
      await db.delete(animeGenres).where(eq(animeGenres.animeId, input.id)).catch(() => undefined);
      await db.delete(anime).where(eq(anime.id, input.id));
      return { success: true };
    }),

  bulkDelete: adminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(episodes).where(inArray(episodes.animeId, input.ids));
      await db.delete(reviews).where(inArray(reviews.animeId, input.ids));
      await db.delete(watchlist).where(inArray(watchlist.animeId, input.ids));
      await db.delete(animeGenres).where(inArray(animeGenres.animeId, input.ids)).catch(() => undefined);
      await db.delete(anime).where(inArray(anime.id, input.ids));
      return { success: true, deletedCount: input.ids.length };
    }),
});
