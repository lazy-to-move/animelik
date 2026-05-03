import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { watchlist, anime, categories } from "@db/schema";

export const watchlistRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    return db
      .select({
        id: watchlist.id,
        userId: watchlist.userId,
        animeId: watchlist.animeId,
        status: watchlist.status,
        currentEpisode: watchlist.currentEpisode,
        createdAt: watchlist.createdAt,
        animeTitle: anime.title,
        animeSlug: anime.slug,
        animeCover: anime.coverImage,
        animeStatus: anime.status,
        animeEpisodesCount: anime.episodesCount,
        categoryName: categories.name,
      })
      .from(watchlist)
      .leftJoin(anime, eq(watchlist.animeId, anime.id))
      .leftJoin(categories, eq(anime.categoryId, categories.id))
      .where(eq(watchlist.userId, userId));
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
      const [inserted] = await db.insert(watchlist).values({
        userId,
        animeId: input.animeId,
        status: input.status ?? "watching",
      }).$returningId();
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
