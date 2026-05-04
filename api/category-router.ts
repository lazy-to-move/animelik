import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { anime, animeGenres, categories } from "@db/schema";

export const categoryRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(categories).orderBy(categories.name);
  }),

  create: adminQuery
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [inserted] = await db.insert(categories).values(input).$returningId();
      const id = inserted.id;
      const results = await db.select().from(categories).where(eq(categories.id, id));
      return results[0];
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(categories).set(data).where(eq(categories.id, id));
      const results = await db.select().from(categories).where(eq(categories.id, id));
      return results[0];
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(anime).set({ categoryId: null }).where(eq(anime.categoryId, input.id));
      await db.delete(animeGenres).where(eq(animeGenres.categoryId, input.id)).catch(() => undefined);
      await db.delete(categories).where(eq(categories.id, input.id));
      return { success: true };
    }),

  bulkDelete: adminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(anime).set({ categoryId: null }).where(inArray(anime.categoryId, input.ids));
      await db.delete(animeGenres).where(inArray(animeGenres.categoryId, input.ids)).catch(() => undefined);
      await db.delete(categories).where(inArray(categories.id, input.ids));
      return { success: true, deletedCount: input.ids.length };
    }),
});
