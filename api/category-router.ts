import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { categories } from "@db/schema";
import {
  adminCategoryBulkDeleteSchema,
  adminCategoryCreateSchema,
  adminCategoryDeleteSchema,
  adminCategoryUpdateSchema,
  createAdminCategory,
  deleteAdminCategoryById,
  deleteAdminCategoryByIds,
  updateAdminCategory,
} from "./services/admin-category-service";

export const categoryRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(categories).orderBy(categories.name);
  }),

  create: adminQuery
    .input(adminCategoryCreateSchema)
    .mutation(async ({ input }) => createAdminCategory(input)),

  update: adminQuery
    .input(adminCategoryUpdateSchema)
    .mutation(async ({ input }) => updateAdminCategory(input)),

  delete: adminQuery
    .input(adminCategoryDeleteSchema)
    .mutation(async ({ input }) => deleteAdminCategoryById(input.id)),

  bulkDelete: adminQuery
    .input(adminCategoryBulkDeleteSchema)
    .mutation(async ({ input }) => deleteAdminCategoryByIds(input.ids)),
});
