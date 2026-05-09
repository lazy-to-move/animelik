import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import {
  getDashboardStats,
  listRecentAnime,
  listRecentScrapeJobs,
  listRecentUsers,
  listTopBrokenEpisodes,
} from "./services/admin-dashboard-service";

export const dashboardRouter = createRouter({
  stats: adminQuery.query(() => getDashboardStats()),

  recentUsers: adminQuery
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(({ input }) => listRecentUsers(input?.limit ?? 10)),

  recentAnime: adminQuery.query(() => listRecentAnime(10)),

  topBrokenEpisodes: adminQuery
    .input(z.object({ limit: z.number().min(1).max(20).optional() }).optional())
    .query(({ input }) => listTopBrokenEpisodes(input?.limit ?? 10)),

  recentScrapeJobs: adminQuery
    .input(z.object({ limit: z.number().min(1).max(20).optional() }).optional())
    .query(({ input }) => listRecentScrapeJobs(input?.limit ?? 8)),
});
