import { and, desc, eq, gte, sql } from "drizzle-orm";
import { episodeBrokenReports, episodes } from "@db/schema";
import { HttpError } from "../lib/http-error";
import { getDb } from "../queries/connection";

const BROKEN_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getBrokenReportWindowStart(now = new Date()) {
  return new Date(now.getTime() - BROKEN_REPORT_COOLDOWN_MS);
}

async function getEpisodeIdentity(episodeId: number) {
  const db = getDb();
  const [episode] = await db
    .select({
      id: episodes.id,
      animeId: episodes.animeId,
      number: episodes.number,
      title: episodes.title,
    })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) {
    throw new HttpError(404, "Episode not found.");
  }

  return episode;
}

async function getReportTotals(episodeId: number, windowStart: Date) {
  const db = getDb();
  const [totals] = await db
    .select({
      totalReports: sql<number>`cast(count(${episodeBrokenReports.id}) as int)`,
      reportsLast24h: sql<number>`
        cast(
          coalesce(
            sum(case when ${episodeBrokenReports.createdAt} >= ${windowStart} then 1 else 0 end),
            0
          ) as int
        )
      `,
    })
    .from(episodeBrokenReports)
    .where(eq(episodeBrokenReports.episodeId, episodeId));

  return {
    totalReports: totals?.totalReports ?? 0,
    reportsLast24h: totals?.reportsLast24h ?? 0,
  };
}

export async function getBrokenEpisodeReportStatusForUser(
  userId: number,
  episodeId: number,
) {
  const db = getDb();
  const windowStart = getBrokenReportWindowStart();
  const [latestReport] = await db
    .select({
      createdAt: episodeBrokenReports.createdAt,
    })
    .from(episodeBrokenReports)
    .where(
      and(
        eq(episodeBrokenReports.userId, userId),
        eq(episodeBrokenReports.episodeId, episodeId),
        gte(episodeBrokenReports.createdAt, windowStart),
      ),
    )
    .orderBy(desc(episodeBrokenReports.createdAt))
    .limit(1);

  const totals = await getReportTotals(episodeId, windowStart);
  const nextReportAt = latestReport?.createdAt
    ? new Date(latestReport.createdAt.getTime() + BROKEN_REPORT_COOLDOWN_MS)
    : null;

  return {
    canReport: !latestReport,
    lastReportedAt: latestReport?.createdAt ?? null,
    nextReportAt,
    ...totals,
  };
}

export async function reportBrokenEpisodeForUser(userId: number, episodeId: number) {
  const db = getDb();
  const episode = await getEpisodeIdentity(episodeId);
  const windowStart = getBrokenReportWindowStart();
  const [existingReport] = await db
    .select({
      id: episodeBrokenReports.id,
      createdAt: episodeBrokenReports.createdAt,
    })
    .from(episodeBrokenReports)
    .where(
      and(
        eq(episodeBrokenReports.userId, userId),
        eq(episodeBrokenReports.episodeId, episodeId),
        gte(episodeBrokenReports.createdAt, windowStart),
      ),
    )
    .orderBy(desc(episodeBrokenReports.createdAt))
    .limit(1);

  if (existingReport) {
    const nextReportAt = new Date(
      existingReport.createdAt.getTime() + BROKEN_REPORT_COOLDOWN_MS,
    );
    throw new HttpError(
      429,
      `You already reported this episode in the last 24 hours. You can report again after ${nextReportAt.toLocaleString()}.`,
    );
  }

  await db.insert(episodeBrokenReports).values({
    userId,
    animeId: episode.animeId,
    episodeId: episode.id,
  });

  const totals = await getReportTotals(episodeId, windowStart);

  return {
    success: true,
    message: `Episode ${episode.number} has been reported for review.`,
    ...totals,
  };
}
