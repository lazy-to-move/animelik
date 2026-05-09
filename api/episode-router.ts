import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { episodeBrokenReports, episodes } from "@db/schema";

const BROKEN_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getBrokenReportWindowStart(now = new Date()) {
  return new Date(now.getTime() - BROKEN_REPORT_COOLDOWN_MS);
}

export const episodeRouter = createRouter({
  list: publicQuery
    .input(z.object({ animeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(episodes)
        .where(eq(episodes.animeId, input.animeId))
        .orderBy(asc(episodes.number));
    }),

  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, input.id))
        .limit(1);
      return results[0] ?? null;
    }),

  byAnimeAndNumber: publicQuery
    .input(z.object({ animeId: z.number(), number: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(episodes)
        .where(
          eq(episodes.animeId, input.animeId)
        )
        .limit(100);
      return results.find(e => e.number === input.number) ?? null;
    }),

  brokenReportStatus: authedQuery
    .input(z.object({ episodeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const windowStart = getBrokenReportWindowStart();
      const [latestReport] = await db
        .select({
          createdAt: episodeBrokenReports.createdAt,
        })
        .from(episodeBrokenReports)
        .where(
          and(
            eq(episodeBrokenReports.userId, ctx.user.id),
            eq(episodeBrokenReports.episodeId, input.episodeId),
            gte(episodeBrokenReports.createdAt, windowStart),
          ),
        )
        .orderBy(desc(episodeBrokenReports.createdAt))
        .limit(1);

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
        .where(eq(episodeBrokenReports.episodeId, input.episodeId));

      const nextReportAt = latestReport?.createdAt
        ? new Date(latestReport.createdAt.getTime() + BROKEN_REPORT_COOLDOWN_MS)
        : null;

      return {
        canReport: !latestReport,
        lastReportedAt: latestReport?.createdAt ?? null,
        nextReportAt,
        totalReports: totals?.totalReports ?? 0,
        reportsLast24h: totals?.reportsLast24h ?? 0,
      };
    }),

  reportBroken: authedQuery
    .input(z.object({ episodeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [episode] = await db
        .select({
          id: episodes.id,
          animeId: episodes.animeId,
          number: episodes.number,
          title: episodes.title,
        })
        .from(episodes)
        .where(eq(episodes.id, input.episodeId))
        .limit(1);

      if (!episode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Episode not found.",
        });
      }

      const windowStart = getBrokenReportWindowStart();
      const [existingReport] = await db
        .select({
          id: episodeBrokenReports.id,
          createdAt: episodeBrokenReports.createdAt,
        })
        .from(episodeBrokenReports)
        .where(
          and(
            eq(episodeBrokenReports.userId, ctx.user.id),
            eq(episodeBrokenReports.episodeId, input.episodeId),
            gte(episodeBrokenReports.createdAt, windowStart),
          ),
        )
        .orderBy(desc(episodeBrokenReports.createdAt))
        .limit(1);

      if (existingReport) {
        const nextReportAt = new Date(existingReport.createdAt.getTime() + BROKEN_REPORT_COOLDOWN_MS);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You already reported this episode in the last 24 hours. You can report again after ${nextReportAt.toLocaleString()}.`,
        });
      }

      await db.insert(episodeBrokenReports).values({
        userId: ctx.user.id,
        animeId: episode.animeId,
        episodeId: episode.id,
      });

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
        .where(eq(episodeBrokenReports.episodeId, input.episodeId));

      return {
        success: true,
        message: `Episode ${episode.number} has been reported for review.`,
        totalReports: totals?.totalReports ?? 1,
        reportsLast24h: totals?.reportsLast24h ?? 1,
      };
    }),

  create: adminQuery
    .input(
      z.object({
        animeId: z.number(),
        number: z.number(),
        title: z.string().optional(),
        synopsis: z.string().optional(),
        thumbnail: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        airDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [inserted] = await db.insert(episodes).values({
        ...input,
        airDate: input.airDate ? new Date(input.airDate) : undefined,
      }).returning({ id: episodes.id });
      const id = inserted.id;
      const results = await db.select().from(episodes).where(eq(episodes.id, id));
      return results[0];
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        number: z.number().optional(),
        title: z.string().optional(),
        synopsis: z.string().optional(),
        thumbnail: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        airDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, airDate, ...data } = input;
      await db
        .update(episodes)
        .set({
          ...data,
          ...(airDate ? { airDate: new Date(airDate) } : {}),
        })
        .where(eq(episodes.id, id));
      const results = await db.select().from(episodes).where(eq(episodes.id, id));
      return results[0];
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(episodes).where(eq(episodes.id, input.id));
      return { success: true };
    }),

  bulkDelete: adminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(episodes).where(inArray(episodes.id, input.ids));
      return { success: true, deletedCount: input.ids.length };
    }),
});
