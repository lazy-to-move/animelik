import { relations } from "drizzle-orm";
import { users, categories, anime, episodes, watchlist, reviews } from "./schema";

export const categoriesRelations = relations(categories, ({ many }) => ({
  anime: many(anime),
}));

export const animeRelations = relations(anime, ({ one, many }) => ({
  category: one(categories, {
    fields: [anime.categoryId],
    references: [categories.id],
  }),
  episodes: many(episodes),
  watchlist: many(watchlist),
  reviews: many(reviews),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  anime: one(anime, {
    fields: [episodes.animeId],
    references: [anime.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  watchlist: many(watchlist),
  reviews: many(reviews),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  anime: one(anime, {
    fields: [watchlist.animeId],
    references: [anime.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  anime: one(anime, {
    fields: [reviews.animeId],
    references: [anime.id],
  }),
}));
