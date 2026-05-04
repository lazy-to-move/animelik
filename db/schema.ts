import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import type { SourceSiteId } from "../api/services/scraper/types";

export type EpisodeVideoSource = {
  server: string;
  quality: "sd" | "hd" | "fhd";
  url: string;
};

export const userRoleEnum = pgEnum("role", ["user", "admin"]);
export const animeStatusEnum = pgEnum("anime_status", ["ongoing", "completed", "upcoming"]);
export const animeTypeEnum = pgEnum("anime_type", ["tv", "movie", "ova", "special"]);
export const watchlistStatusEnum = pgEnum("watchlist_status", ["watching", "completed", "plan_to_watch", "dropped"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  googleId: varchar("googleId", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt", { mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export const anime = pgTable("anime", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  titleEnglish: varchar("titleEnglish", { length: 255 }),
  titleJp: varchar("titleJp", { length: 255 }),
  titleSynonyms: jsonb("titleSynonyms").$type<string[] | null>(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  synopsis: text("synopsis").notNull(),
  coverImage: varchar("coverImage", { length: 500 }),
  bannerImage: varchar("bannerImage", { length: 500 }),
  status: animeStatusEnum("status").default("upcoming"),
  type: animeTypeEnum("type").default("tv"),
  rating: varchar("rating", { length: 10 }),
  releaseYear: integer("releaseYear"),
  studio: varchar("studio", { length: 100 }),
  score: numeric("score", { precision: 3, scale: 2 }).default("0.00"),
  episodesCount: integer("episodesCount").default(0),
  duration: integer("duration"),
  featured: boolean("featured").default(false),
  categoryId: integer("categoryId").references(() => categories.id),
  externalId: varchar("externalId", { length: 255 }),
  externalSlug: varchar("externalSlug", { length: 255 }),
  sourceSite: varchar("sourceSite", { length: 50 }).$type<SourceSiteId | null>(),
  broadcastDay: varchar("broadcastDay", { length: 20 }),
  broadcastTime: varchar("broadcastTime", { length: 10 }),
  broadcastTimezone: varchar("broadcastTimezone", { length: 64 }),
  broadcastText: varchar("broadcastText", { length: 120 }),
  broadcastFetchedAt: timestamp("broadcastFetchedAt", { mode: "date" }),
  lastScrapedAt: timestamp("lastScrapedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Anime = typeof anime.$inferSelect;
export type InsertAnime = typeof anime.$inferInsert;

export const animeGenres = pgTable("animeGenres", {
  id: serial("id").primaryKey(),
  animeId: integer("animeId").notNull().references(() => anime.id),
  categoryId: integer("categoryId").notNull().references(() => categories.id),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type AnimeGenre = typeof animeGenres.$inferSelect;
export type InsertAnimeGenre = typeof animeGenres.$inferInsert;

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  animeId: integer("animeId").notNull().references(() => anime.id),
  number: integer("number").notNull(),
  title: varchar("title", { length: 255 }),
  synopsis: text("synopsis"),
  thumbnail: varchar("thumbnail", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),
  videoSources: jsonb("videoSources").$type<EpisodeVideoSource[] | null>(),
  duration: integer("duration"),
  airDate: date("airDate", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  animeId: integer("animeId").notNull().references(() => anime.id),
  status: watchlistStatusEnum("status").default("watching"),
  currentEpisode: integer("currentEpisode").default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = typeof watchlist.$inferInsert;

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  animeId: integer("animeId").notNull().references(() => anime.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;
