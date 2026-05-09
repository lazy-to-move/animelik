import { desc, eq, sql } from "drizzle-orm";
import {
  anime,
  episodeBrokenReports,
  episodes,
  reviews,
  scrapeJobs,
  users,
} from "@db/schema";
import { getDb } from "../queries/connection";

export async function getDashboardStats() {
  const db = getDb();
  const [totalUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  const [totalAnime] = await db
    .select({ count: sql<number>`count(*)` })
    .from(anime);
  const [totalEpisodes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(episodes);
  const [totalReviews] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviews);

  return {
    totalUsers: totalUsers.count,
    totalAnime: totalAnime.count,
    totalEpisodes: totalEpisodes.count,
    totalReviews: totalReviews.count,
  };
}

export async function listRecentUsers(limit = 10) {
  const db = getDb();
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
}

export async function listRecentAnime(limit = 10) {
  const db = getDb();
  return db
    .select({
      id: anime.id,
      title: anime.title,
      slug: anime.slug,
      coverImage: anime.coverImage,
      status: anime.status,
      score: anime.score,
      sourceSite: anime.sourceSite,
      externalSlug: anime.externalSlug,
      createdAt: anime.createdAt,
    })
    .from(anime)
    .orderBy(desc(anime.createdAt))
    .limit(limit);
}

export async function listTopBrokenEpisodes(limit = 10) {
  const db = getDb();
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
}

export async function getScrapeJobSummary() {
  const db = getDb();
  const [summary] = await db
    .select({
      pending: sql<number>`
        cast(coalesce(sum(case when ${scrapeJobs.status} = 'pending' then 1 else 0 end), 0) as int)
      `,
      running: sql<number>`
        cast(coalesce(sum(case when ${scrapeJobs.status} = 'running' then 1 else 0 end), 0) as int)
      `,
      completed: sql<number>`
        cast(coalesce(sum(case when ${scrapeJobs.status} = 'completed' then 1 else 0 end), 0) as int)
      `,
      failed: sql<number>`
        cast(coalesce(sum(case when ${scrapeJobs.status} = 'failed' then 1 else 0 end), 0) as int)
      `,
    })
    .from(scrapeJobs);

  return {
    pending: summary?.pending ?? 0,
    running: summary?.running ?? 0,
    completed: summary?.completed ?? 0,
    failed: summary?.failed ?? 0,
  };
}

export async function listRecentScrapeJobs(limit = 8) {
  const db = getDb();
  return db
    .select({
      id: scrapeJobs.id,
      type: scrapeJobs.type,
      status: scrapeJobs.status,
      errorMessage: scrapeJobs.errorMessage,
      createdAt: scrapeJobs.createdAt,
      startedAt: scrapeJobs.startedAt,
      completedAt: scrapeJobs.completedAt,
      requestedByUserId: scrapeJobs.requestedByUserId,
      requestedByName: users.name,
      requestedByEmail: users.email,
    })
    .from(scrapeJobs)
    .leftJoin(users, eq(scrapeJobs.requestedByUserId, users.id))
    .orderBy(desc(scrapeJobs.createdAt))
    .limit(limit);
}

export async function getAdminOverview(limit = 8) {
  const [stats, queue, recentUsers, recentAnime, topBrokenEpisodes, recentScrapeJobs] =
    await Promise.all([
      getDashboardStats(),
      getScrapeJobSummary(),
      listRecentUsers(limit),
      listRecentAnime(limit),
      listTopBrokenEpisodes(limit),
      listRecentScrapeJobs(limit),
    ]);

  return {
    stats,
    queue,
    recentUsers,
    recentAnime,
    topBrokenEpisodes,
    recentScrapeJobs,
  };
}
