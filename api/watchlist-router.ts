import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { watchlist, anime, animeGenres, categories } from "@db/schema";

export const watchlistRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    const items = await db
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
      .where(eq(watchlist.userId, userId));

    const animeIds = items.map((item) => item.animeId);
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

    const genreRows = animeIds.length === 0
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
  }),

  add: authedQuery
    .input(
      z.object({
        animeId: z.number(),
        status: z.enum(["watching", "completed", "plan_to_watch", "dropped"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const existing = await db
        .select()
        .from(watchlist)
        .where(and(eq(watchlist.userId, userId), eq(watchlist.animeId, input.animeId)))
        .limit(1);

      if (existing[0]) {
        if (input.status && input.status !== existing[0].status) {
          await db
            .update(watchlist)
            .set({ status: input.status })
            .where(eq(watchlist.id, existing[0].id));
          const refreshed = await db.select().from(watchlist).where(eq(watchlist.id, existing[0].id)).limit(1);
          return refreshed[0];
        }

        return existing[0];
      }

      const [inserted] = await db.insert(watchlist).values({
        userId,
        animeId: input.animeId,
        status: input.status ?? "watching",
      }).returning({ id: watchlist.id });
      const id = inserted.id;
      const results = await db.select().from(watchlist).where(eq(watchlist.id, id));
      return results[0];
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["watching", "completed", "plan_to_watch", "dropped"]).optional(),
        currentEpisode: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const { id, ...data } = input;
      await db
        .update(watchlist)
        .set(data)
        .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
      const results = await db
        .select()
        .from(watchlist)
        .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
      return results[0];
    }),

  remove: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      await db
        .delete(watchlist)
        .where(and(eq(watchlist.id, input.id), eq(watchlist.userId, userId)));
      return { success: true };
    }),
});
