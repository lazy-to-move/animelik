import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { reviews, users } from "@db/schema";

export const reviewRouter = createRouter({
  list: publicQuery
    .input(z.object({ animeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          animeId: reviews.animeId,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          userName: users.name,
          userAvatar: users.avatar,
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(eq(reviews.animeId, input.animeId))
        .orderBy(desc(reviews.createdAt));
    }),

  create: authedQuery
    .input(
      z.object({
        animeId: z.number(),
        rating: z.number().min(1).max(10),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const [inserted] = await db.insert(reviews).values({
        userId,
        animeId: input.animeId,
        rating: input.rating,
        comment: input.comment,
      }).$returningId();
      const id = inserted.id;
      const results = await db.select().from(reviews).where(eq(reviews.id, id));
      return results[0];
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const userRole = ctx.user.role;

      if (userRole === "admin") {
        await db.delete(reviews).where(eq(reviews.id, input.id));
      } else {
        await db
          .delete(reviews)
          .where(and(eq(reviews.id, input.id), eq(reviews.userId, userId)));
      }
      return { success: true };
    }),
});
