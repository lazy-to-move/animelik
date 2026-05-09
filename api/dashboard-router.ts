import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, anime, episodeBrokenReports, episodes, reviews } from "@db/schema";

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

  topBrokenEpisodes: adminQuery
    .input(z.object({ limit: z.number().min(1).max(20).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 10;
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const reportsCount = sql<number>`cast(count(${episodeBrokenReports.id}) as int)`;
      const reportsLast24h = sql<number>`
        cast(
          coalesce(
            sum(case when ${episodeBrokenReports.createdAt} >= ${windowStart} then 1 else 0 end),
            0
          ) as int
        )
      `;
      const lastReportedAt = sql<Date | null>`max(${episodeBrokenReports.createdAt})`;

      return db
        .select({
          episodeId: episodes.id,
          episodeNumber: episodes.number,
          episodeTitle: episodes.title,
          animeId: anime.id,
          animeTitle: anime.title,
          animeSlug: anime.slug,
          reportsCount,
          reportsLast24h,
          lastReportedAt,
        })
        .from(episodeBrokenReports)
        .innerJoin(episodes, eq(episodeBrokenReports.episodeId, episodes.id))
        .innerJoin(anime, eq(episodeBrokenReports.animeId, anime.id))
        .groupBy(episodes.id, anime.id)
        .orderBy(desc(reportsCount), desc(lastReportedAt))
        .limit(limit);
    }),
});
