import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { anime, episodeBrokenReports, episodes, users } from "@db/schema";
import { z } from "zod";
import { getDb } from "../queries/connection";

export const adminBrokenEpisodeListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  recentLimit: z.coerce.number().int().min(1).max(50).default(12),
});

function buildBrokenReportSearchFilter(search: string | undefined) {
  if (!search) return undefined;
  const pattern = `%${search}%`;
  return or(
    ilike(anime.title, pattern),
    ilike(anime.titleEnglish, pattern),
    ilike(anime.slug, pattern),
    ilike(episodes.title, pattern),
  );
}

export async function listAdminBrokenEpisodeLeaderboard(input: {
  search?: string;
  limit?: number;
} = {}) {
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
  const filter = buildBrokenReportSearchFilter(input.search);

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
    .where(filter)
    .groupBy(episodes.id, anime.id)
    .orderBy(desc(reportsCount), desc(lastReportedAt))
    .limit(input.limit ?? 20);
}

export async function listRecentBrokenEpisodeReports(input: {
  search?: string;
  limit?: number;
} = {}) {
  const db = getDb();
  const filter = buildBrokenReportSearchFilter(input.search);

  return db
    .select({
      id: episodeBrokenReports.id,
      createdAt: episodeBrokenReports.createdAt,
      animeId: anime.id,
      animeTitle: anime.title,
      animeSlug: anime.slug,
      episodeId: episodes.id,
      episodeNumber: episodes.number,
      episodeTitle: episodes.title,
      reportedByName: users.name,
      reportedByEmail: users.email,
    })
    .from(episodeBrokenReports)
    .innerJoin(episodes, eq(episodeBrokenReports.episodeId, episodes.id))
    .innerJoin(anime, eq(episodeBrokenReports.animeId, anime.id))
    .leftJoin(users, eq(episodeBrokenReports.userId, users.id))
    .where(filter)
    .orderBy(desc(episodeBrokenReports.createdAt))
    .limit(input.limit ?? 12);
}
