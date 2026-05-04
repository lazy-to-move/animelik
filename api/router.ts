import { authRouter } from "./auth-router";
import { animeRouter } from "./anime-router";
import { episodeRouter } from "./episode-router";
import { categoryRouter } from "./category-router";
import { watchlistRouter } from "./watchlist-router";
import { reviewRouter } from "./review-router";
import { dashboardRouter } from "./dashboard-router";
import { scraperRouter } from "./scraper-router";
import { scheduleRouter } from "./schedule-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  anime: animeRouter,
  episode: episodeRouter,
  category: categoryRouter,
  watchlist: watchlistRouter,
  review: reviewRouter,
  dashboard: dashboardRouter,
  scraper: scraperRouter,
  schedule: scheduleRouter,
});

export type AppRouter = typeof appRouter;
