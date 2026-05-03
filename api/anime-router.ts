import { z } from "zod";
import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { anime, categories, episodes, reviews, watchlist } from "@db/schema";
import { SOURCE_SITE_IDS } from "./services/scraper/types";

const sourceSiteSchema = z.enum(SOURCE_SITE_IDS);

function normalizeRouteSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "");
}

const animeListInput = z.object({
  category: z.string().optional(),
  status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
  search: z.string().optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
}).optional();

const animeSelection = {
  id: anime.id,
  title: anime.title,
  titleJp: anime.titleJp,
  slug: anime.slug,
  synopsis: anime.synopsis,
  coverImage: anime.coverImage,
  bannerImage: anime.bannerImage,
  status: anime.status,
  type: anime.type,
  rating: anime.rating,
  releaseYear: anime.releaseYear,
  studio: anime.studio,
  score: anime.score,
  episodesCount: anime.episodesCount,
  duration: anime.duration,
  featured: anime.featured,
  categoryId: anime.categoryId,
  externalId: anime.externalId,
  externalSlug: anime.externalSlug,
  sourceSite: anime.sourceSite,
  lastScrapedAt: anime.lastScrapedAt,
  createdAt: anime.createdAt,
  updatedAt: anime.updatedAt,
  categoryName: categories.name,
} as const;

export const animeRouter = createRouter({
  list: publicQuery
    .input(animeListInput)
    .query(async ({ input }) => {
      const db = getDb();

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      const offset = (page - 1) * limit;

      const filters = [
        input?.category ? eq(categories.slug, input.category) : undefined,
        input?.status ? eq(anime.status, input.status) : undefined,
        input?.search
          ? like(sql`lower(${anime.title})`, `%${input.search.toLowerCase()}%`)
          : undefined,
      ].filter((value): value is NonNullable<typeof value> => value !== undefined);

      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const items = await db
        .select(animeSelection)
        .from(anime)
        .leftJoin(categories, eq(anime.categoryId, categories.id))
        .where(whereClause)
        .orderBy(desc(anime.createdAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(anime)
        .leftJoin(categories, eq(anime.categoryId, categories.id))
        .where(whereClause);

      return {
        items,
        total: countResult?.count ?? 0,
      };
    }),

  featured: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select(animeSelection)
      .from(anime)
      .leftJoin(categories, eq(anime.categoryId, categories.id))
      .where(eq(anime.featured, true))
      .orderBy(desc(anime.createdAt))
      .limit(6);
  }),

  trending: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select(animeSelection)
      .from(anime)
      .leftJoin(categories, eq(anime.categoryId, categories.id))
      .orderBy(desc(anime.score))
      .limit(8);
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const normalizedSlug = normalizeRouteSlug(input.slug);
      const results = await db
        .select(animeSelection)
        .from(anime)
        .leftJoin(categories, eq(anime.categoryId, categories.id))
        .where(or(eq(anime.slug, normalizedSlug), eq(anime.slug, `${normalizedSlug}/`)))
        .limit(1);
      return results[0] ?? null;
    }),

  create: adminQuery
    .input(
      z.object({
        title: z.string().min(1),
        titleJp: z.string().optional(),
        slug: z.string().min(1),
        synopsis: z.string().min(1),
        coverImage: z.string().optional(),
        bannerImage: z.string().optional(),
        status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
        type: z.enum(["tv", "movie", "ova", "special"]).optional(),
        rating: z.string().optional(),
        releaseYear: z.number().optional(),
        studio: z.string().optional(),
        categoryId: z.number().optional(),
        duration: z.number().optional(),
        featured: z.boolean().optional(),
        sourceSite: sourceSiteSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [inserted] = await db.insert(anime).values(input).$returningId();
      const id = inserted.id;
      const results = await db.select().from(anime).where(eq(anime.id, id));
      return results[0];
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        titleJp: z.string().optional(),
        slug: z.string().min(1).optional(),
        synopsis: z.string().min(1).optional(),
        coverImage: z.string().optional(),
        bannerImage: z.string().optional(),
        status: z.enum(["ongoing", "completed", "upcoming"]).optional(),
        type: z.enum(["tv", "movie", "ova", "special"]).optional(),
        rating: z.string().optional(),
        releaseYear: z.number().optional(),
        studio: z.string().optional(),
        categoryId: z.number().optional(),
        duration: z.number().optional(),
        featured: z.boolean().optional(),
        sourceSite: sourceSiteSchema.optional(),
        score: z.string().optional(),
        episodesCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(anime).set(data).where(eq(anime.id, id));
      const results = await db.select().from(anime).where(eq(anime.id, id));
      return results[0];
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(episodes).where(eq(episodes.animeId, input.id));
      await db.delete(reviews).where(eq(reviews.animeId, input.id));
      await db.delete(watchlist).where(eq(watchlist.animeId, input.id));
      await db.delete(anime).where(eq(anime.id, input.id));
      return { success: true };
    }),
});
