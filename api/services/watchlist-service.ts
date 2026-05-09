import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { anime, animeGenres, categories, watchlist } from "@db/schema";
import { getDb } from "../queries/connection";

export const watchlistStatusSchema = z.enum([
  "watching",
  "completed",
  "plan_to_watch",
  "dropped",
]);

export const addWatchlistItemSchema = z.object({
  animeId: z.number(),
  status: watchlistStatusSchema.optional(),
  currentEpisode: z.number().min(0).optional(),
});

export const updateWatchlistItemSchema = z.object({
  id: z.number(),
  status: watchlistStatusSchema.optional(),
  currentEpisode: z.number().min(0).optional(),
});

type WatchlistBaseRow = {
  id: number;
  userId: number;
  animeId: number;
  status: "watching" | "completed" | "plan_to_watch" | "dropped" | null;
  currentEpisode: number | null;
  createdAt: Date;
  animeTitle: string | null;
  animeTitleEnglish: string | null;
  animeTitleJp: string | null;
  animeSlug: string | null;
  animeCover: string | null;
  animeBanner: string | null;
  animeStatus: string | null;
  animeType: string | null;
  animeScore: string | null;
  animeReleaseYear: number | null;
  animeEpisodesCount: number | null;
  categoryId: number | null;
};

type GenreEnriched<T extends { animeId: number; categoryId: number | null }> = T & {
  genres: string[];
  genreNames: string;
  categoryName?: string;
};

async function attachGenres<T extends { animeId: number; categoryId: number | null }>(
  items: T[],
): Promise<Array<GenreEnriched<T>>> {
  const db = getDb();
  const animeIds = items.map((item) => item.animeId);
  const fallbackCategoryIds = Array.from(
    new Set(
      items
        .map((item) => item.categoryId)
        .filter((value): value is number => value !== null),
    ),
  );

  const fallbackCategories =
    fallbackCategoryIds.length === 0
      ? []
      : await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, fallbackCategoryIds));

  const fallbackCategoryMap = new Map(
    fallbackCategories.map((category) => [category.id, category.name] as const),
  );

  const genreRows =
    animeIds.length === 0
      ? []
      : await db
          .select({
            animeId: animeGenres.animeId,
            categoryId: categories.id,
            categoryName: categories.name,
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
    const genres = genreMap.get(item.animeId) ?? [];
    const uniqueNames = Array.from(new Set(genres.map((genre) => genre.name)));
    const primaryCategory =
      genres.find((genre) => genre.id === item.categoryId)?.name ??
      (item.categoryId ? fallbackCategoryMap.get(item.categoryId) : undefined) ??
      uniqueNames[0];
    const allGenreNames =
      primaryCategory && !uniqueNames.includes(primaryCategory)
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

async function selectWatchlistRows(where: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const db = getDb();
  return db
    .select({
      id: watchlist.id,
      userId: watchlist.userId,
      animeId: watchlist.animeId,
      status: watchlist.status,
      currentEpisode: watchlist.currentEpisode,
      createdAt: watchlist.createdAt,
      animeTitle: anime.title,
      animeTitleEnglish: anime.titleEnglish,
      animeTitleJp: anime.titleJp,
      animeSlug: anime.slug,
      animeCover: anime.coverImage,
      animeBanner: anime.bannerImage,
      animeStatus: anime.status,
      animeType: anime.type,
      animeScore: anime.score,
      animeReleaseYear: anime.releaseYear,
      animeEpisodesCount: anime.episodesCount,
      categoryId: anime.categoryId,
    })
    .from(watchlist)
    .leftJoin(anime, eq(watchlist.animeId, anime.id))
    .where(where);
}

async function getWatchlistItemForUser(userId: number, id: number) {
  const items = await selectWatchlistRows(
    and(eq(watchlist.userId, userId), eq(watchlist.id, id)),
  );
  const [item] = await attachGenres(items satisfies WatchlistBaseRow[]);
  return item ?? null;
}

export async function listWatchlistForUser(userId: number) {
  const items = await selectWatchlistRows(eq(watchlist.userId, userId));
  return attachGenres(items satisfies WatchlistBaseRow[]);
}

export async function addWatchlistItemForUser(
  userId: number,
  input: z.infer<typeof addWatchlistItemSchema>,
) {
  const db = getDb();
  const existing = await db
    .select({
      id: watchlist.id,
      status: watchlist.status,
      currentEpisode: watchlist.currentEpisode,
    })
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.animeId, input.animeId)))
    .limit(1);

  if (existing[0]) {
    const updates: Partial<{
      status: z.infer<typeof watchlistStatusSchema>;
      currentEpisode: number;
    }> = {};

    if (input.status && input.status !== existing[0].status) {
      updates.status = input.status;
    }

    if (
      typeof input.currentEpisode === "number" &&
      input.currentEpisode !== (existing[0].currentEpisode ?? 0)
    ) {
      updates.currentEpisode = input.currentEpisode;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(watchlist)
        .set(updates)
        .where(eq(watchlist.id, existing[0].id));
    }

    return getWatchlistItemForUser(userId, existing[0].id);
  }

  const [inserted] = await db
    .insert(watchlist)
    .values({
      userId,
      animeId: input.animeId,
      status: input.status ?? "watching",
      currentEpisode: input.currentEpisode ?? 0,
    })
    .returning({ id: watchlist.id });

  return getWatchlistItemForUser(userId, inserted.id);
}

export async function updateWatchlistItemForUser(
  userId: number,
  input: z.infer<typeof updateWatchlistItemSchema>,
) {
  const db = getDb();
  const { id, ...data } = input;
  await db
    .update(watchlist)
    .set(data)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));

  return getWatchlistItemForUser(userId, id);
}

export async function removeWatchlistItemForUser(userId: number, id: number) {
  const db = getDb();
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
  return { success: true };
}

export type PublicWatchlistItem = Awaited<ReturnType<typeof listWatchlistForUser>>[number];
