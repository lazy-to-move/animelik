import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { episodes } from "@db/schema";
import {
  getBrokenEpisodeReportStatusForUser,
  reportBrokenEpisodeForUser,
} from "./services/broken-episode-service";
import {
  adminEpisodeBulkDeleteSchema,
  adminEpisodeCreateSchema,
  adminEpisodeDeleteSchema,
  adminEpisodeUpdateSchema,
  createAdminEpisode,
  deleteAdminEpisodeById,
  deleteAdminEpisodeByIds,
  updateAdminEpisode,
} from "./services/admin-episode-service";

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
    .query(async ({ ctx, input }) =>
      getBrokenEpisodeReportStatusForUser(ctx.user.id, input.episodeId),
    ),

  reportBroken: authedQuery
    .input(z.object({ episodeId: z.number() }))
    .mutation(async ({ ctx, input }) =>
      reportBrokenEpisodeForUser(ctx.user.id, input.episodeId),
    ),

  create: adminQuery
    .input(adminEpisodeCreateSchema)
    .mutation(async ({ input }) => createAdminEpisode(input)),

  update: adminQuery
    .input(adminEpisodeUpdateSchema)
    .mutation(async ({ input }) => updateAdminEpisode(input)),

  delete: adminQuery
    .input(adminEpisodeDeleteSchema)
    .mutation(async ({ input }) => deleteAdminEpisodeById(input.id)),

  bulkDelete: adminQuery
    .input(adminEpisodeBulkDeleteSchema)
    .mutation(async ({ input }) => deleteAdminEpisodeByIds(input.ids)),
});
