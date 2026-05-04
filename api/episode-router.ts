import { z } from "zod";
import { eq, asc, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { episodes } from "@db/schema";

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
