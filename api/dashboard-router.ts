import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, anime, episodes, reviews } from "@db/schema";

export const dashboardRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [totalAnime] = await db.select({ count: sql<number>`count(*)` }).from(anime);
    const [totalEpisodes] = await db.select({ count: sql<number>`count(*)` }).from(episodes);
    const [totalReviews] = await db.select({ count: sql<number>`count(*)` }).from(reviews);

    return {
      totalUsers: totalUsers.count,
      totalAnime: totalAnime.count,
      totalEpisodes: totalEpisodes.count,
      totalReviews: totalReviews.count,
    };
  }),

  recentUsers: adminQuery
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 10;
      return db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit);
    }),

  recentAnime: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: anime.id,
        title: anime.title,
        slug: anime.slug,
        coverImage: anime.coverImage,
        status: anime.status,
        score: anime.score,
        createdAt: anime.createdAt,
      })
      .from(anime)
      .orderBy(desc(anime.createdAt))
      .limit(10);
  }),
});
