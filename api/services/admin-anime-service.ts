import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { normalizeSearchText, scoreAnimeSearch } from "../lib/anime-search";
import { getDb } from "../queries/connection";
import { anime, animeGenres, episodes, reviews, watchlist } from "@db/schema";
import { SOURCE_SITE_IDS } from "./scraper/types";

const animeStatusSchema = z.enum(["ongoing", "completed", "upcoming"]);

export const adminAnimeListQuerySchema = z.object({
  search: z.string().optional(),
  status: animeStatusSchema.optional(),
  sourceSite: z.enum(SOURCE_SITE_IDS).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(60).optional(),
});

export const adminAnimeDeleteSchema = z.object({
  id: z.number().int().positive(),
});

export const adminAnimeBulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

const adminAnimeSelection = {
  id: anime.id,
  title: anime.title,
  titleEnglish: anime.titleEnglish,
  titleJp: anime.titleJp,
  titleSynonyms: anime.titleSynonyms,
  slug: anime.slug,
  status: anime.status,
  type: anime.type,
  sourceSite: anime.sourceSite,
  externalSlug: anime.externalSlug,
  episodesCount: anime.episodesCount,
  score: anime.score,
  coverImage: anime.coverImage,
  metadataSource: anime.metadataSource,
  lastScrapedAt: anime.lastScrapedAt,
  createdAt: anime.createdAt,
  updatedAt: anime.updatedAt,
} as const;

type AdminAnimeRow = {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJp: string | null;
  titleSynonyms: string[] | null;
  slug: string;
  status: "ongoing" | "completed" | "upcoming" | null;
  type: string | null;
  sourceSite: string | null;
  externalSlug: string | null;
  episodesCount: number | null;
  score: string | null;
  coverImage: string | null;
  metadataSource: string | null;
  lastScrapedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function buildAdminAnimeWhereClause(input: z.infer<typeof adminAnimeListQuerySchema>) {
  const filters = [
    input.status ? eq(anime.status, input.status) : undefined,
    input.sourceSite ? eq(anime.sourceSite, input.sourceSite) : undefined,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);

  return filters.length > 0 ? and(...filters) : undefined;
}

export async function listAdminAnimePage(
  rawInput: z.input<typeof adminAnimeListQuerySchema> = {},
) {
  const input = adminAnimeListQuerySchema.parse(rawInput);
  const db = getDb();
  const limit = input.limit ?? 24;
  const page = input.page ?? 1;
  const offset = (page - 1) * limit;
  const normalizedSearch = normalizeSearchText(input.search);
  const whereClause = buildAdminAnimeWhereClause(input);

  let items: AdminAnimeRow[];
  let total = 0;

  if (normalizedSearch) {
    const baseItems = await db
      .select(adminAnimeSelection)
      .from(anime)
      .where(whereClause)
      .orderBy(desc(anime.createdAt));

    const matchedItems = baseItems
      .map((item) => ({
        item: item as AdminAnimeRow,
        score: scoreAnimeSearch(item, normalizedSearch),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          Number(right.item.score ?? 0) - Number(left.item.score ?? 0) ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime(),
      )
      .map((entry) => entry.item);

    total = matchedItems.length;
    items = matchedItems.slice(offset, offset + limit);
  } else {
    items = (await db
      .select(adminAnimeSelection)
      .from(anime)
      .where(whereClause)
      .orderBy(desc(anime.createdAt))
      .limit(limit)
      .offset(offset)) as AdminAnimeRow[];

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(anime)
      .where(whereClause);

    total = countResult?.count ?? 0;
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasPreviousPage: page > 1,
    hasNextPage: offset + items.length < total,
  };
}

export async function deleteAdminAnimeById(id: number) {
  const db = getDb();
  await db.delete(episodes).where(eq(episodes.animeId, id));
  await db.delete(reviews).where(eq(reviews.animeId, id));
  await db.delete(watchlist).where(eq(watchlist.animeId, id));
  await db.delete(animeGenres).where(eq(animeGenres.animeId, id)).catch(() => undefined);
  await db.delete(anime).where(eq(anime.id, id));
  return { success: true };
}

export async function deleteAdminAnimeByIds(ids: number[]) {
  const db = getDb();
  await db.delete(episodes).where(inArray(episodes.animeId, ids));
  await db.delete(reviews).where(inArray(reviews.animeId, ids));
  await db.delete(watchlist).where(inArray(watchlist.animeId, ids));
  await db.delete(animeGenres).where(inArray(animeGenres.animeId, ids)).catch(() => undefined);
  await db.delete(anime).where(inArray(anime.id, ids));
  return { success: true, deletedCount: ids.length };
}
