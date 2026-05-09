import { eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { anime, animeGenres, categories } from "@db/schema";
import { getDb } from "../queries/connection";

export const adminCategoryListQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export const adminCategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Category name is required."),
  slug: z.string().trim().min(1, "Category slug is required."),
  description: z.string().trim().optional(),
});

export const adminCategoryUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1, "Category name is required.").optional(),
  slug: z.string().trim().min(1, "Category slug is required.").optional(),
  description: z.string().trim().optional(),
});

export const adminCategoryDeleteSchema = z.object({
  id: z.number().int().positive(),
});

export const adminCategoryBulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function listAdminCategories(
  rawInput: z.input<typeof adminCategoryListQuerySchema> = {},
) {
  const input = adminCategoryListQuerySchema.parse(rawInput);
  const db = getDb();
  const search = input.search?.trim();
  const whereClause = search ? ilike(categories.name, `%${search}%`) : undefined;

  const categoryRows = await db
    .select()
    .from(categories)
    .where(whereClause)
    .orderBy(categories.name);

  const ids = categoryRows.map((item) => item.id);
  const [primaryCounts, tagCounts] = ids.length
    ? await Promise.all([
        db
          .select({
            categoryId: anime.categoryId,
          })
          .from(anime)
          .where(inArray(anime.categoryId, ids)),
        db
          .select({
            categoryId: animeGenres.categoryId,
          })
          .from(animeGenres)
          .where(inArray(animeGenres.categoryId, ids))
          .catch(() => [] as Array<{ categoryId: number }>),
      ])
    : [[], []];

  const primaryCountMap = new Map<number, number>();
  for (const row of primaryCounts) {
    if (row.categoryId === null) continue;
    primaryCountMap.set(row.categoryId, (primaryCountMap.get(row.categoryId) ?? 0) + 1);
  }

  const tagCountMap = new Map<number, number>();
  for (const row of tagCounts) {
    tagCountMap.set(row.categoryId, (tagCountMap.get(row.categoryId) ?? 0) + 1);
  }

  return categoryRows.map((item) => ({
    ...item,
    animeCount: primaryCountMap.get(item.id) ?? 0,
    taggedAnimeCount: tagCountMap.get(item.id) ?? 0,
  }));
}

export async function createAdminCategory(
  rawInput: z.input<typeof adminCategoryCreateSchema>,
) {
  const input = adminCategoryCreateSchema.parse(rawInput);
  const db = getDb();
  const [inserted] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      description: normalizeOptionalText(input.description),
    })
    .returning({ id: categories.id });

  const [result] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, inserted.id));

  return result;
}

export async function updateAdminCategory(
  rawInput: z.input<typeof adminCategoryUpdateSchema>,
) {
  const input = adminCategoryUpdateSchema.parse(rawInput);
  const db = getDb();
  const { id, ...rest } = input;
  const data = {
    ...rest,
    ...(rest.description !== undefined
      ? { description: normalizeOptionalText(rest.description) }
      : {}),
  };

  await db.update(categories).set(data).where(eq(categories.id, id));
  const [result] = await db.select().from(categories).where(eq(categories.id, id));
  return result;
}

export async function deleteAdminCategoryById(id: number) {
  const db = getDb();
  await db.update(anime).set({ categoryId: null }).where(eq(anime.categoryId, id));
  await db.delete(animeGenres).where(eq(animeGenres.categoryId, id)).catch(() => undefined);
  await db.delete(categories).where(eq(categories.id, id));
  return { success: true };
}

export async function deleteAdminCategoryByIds(ids: number[]) {
  const db = getDb();
  await db.update(anime).set({ categoryId: null }).where(inArray(anime.categoryId, ids));
  await db.delete(animeGenres).where(inArray(animeGenres.categoryId, ids)).catch(() => undefined);
  await db.delete(categories).where(inArray(categories.id, ids));
  return { success: true, deletedCount: ids.length };
}
