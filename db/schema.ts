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
  index,
  uniqueIndex,
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
export const scrapeJobTypeEnum = pgEnum("scrape_job_type", ["import_from_source", "sync_all_episodes", "refresh_anime_metadata", "queue_probe"]);
export const scrapeJobStatusEnum = pgEnum("scrape_job_status", ["pending", "running", "completed", "failed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  googleId: varchar("googleId", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
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
  coverImageSource: varchar("coverImageSource", { length: 50 }),
  bannerImage: varchar("bannerImage", { length: 500 }),
  bannerImageSource: varchar("bannerImageSource", { length: 50 }),
  metadataSource: varchar("metadataSource", { length: 50 }),
  status: animeStatusEnum("status").default("upcoming"),
  type: animeTypeEnum("type").default("tv"),
  rating: varchar("rating", { length: 10 }),
  releaseYear: integer("releaseYear"),
  studio: varchar("studio", { length: 100 }),
  score: numeric("score", { precision: 4, scale: 2 }).default("0.00"),
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
  seasonNumber: integer("seasonNumber"),
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

export const watchlist = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    animeId: integer("animeId").notNull().references(() => anime.id),
    status: watchlistStatusEnum("status").default("watching"),
    currentEpisode: integer("currentEpisode").default(0),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userAnimeUnique: uniqueIndex("watchlist_user_anime_unique").on(table.userId, table.animeId),
  }),
);

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = typeof watchlist.$inferInsert;

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    animeId: integer("animeId").notNull().references(() => anime.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userAnimeUnique: uniqueIndex("reviews_user_anime_unique").on(table.userId, table.animeId),
  }),
);

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const episodeBrokenReports = pgTable(
  "episodeBrokenReports",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    animeId: integer("animeId").notNull().references(() => anime.id),
    episodeId: integer("episodeId").notNull().references(() => episodes.id),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("episode_broken_reports_user_created_idx").on(table.userId, table.createdAt),
    episodeCreatedIdx: index("episode_broken_reports_episode_created_idx").on(table.episodeId, table.createdAt),
    animeCreatedIdx: index("episode_broken_reports_anime_created_idx").on(table.animeId, table.createdAt),
  }),
);

export type EpisodeBrokenReport = typeof episodeBrokenReports.$inferSelect;
export type InsertEpisodeBrokenReport = typeof episodeBrokenReports.$inferInsert;

export type ScrapeJobPayload = {
  source?: SourceSiteId;
  slug?: string;
  importEpisodes?: boolean;
  animeId?: number;
  probeId?: string;
};

export type ScrapeJobResult = {
  success: boolean;
  error?: string;
  [key: string]: unknown;
};

export const scrapeJobs = pgTable(
  "scrapeJobs",
  {
    id: serial("id").primaryKey(),
    type: scrapeJobTypeEnum("type").notNull(),
    status: scrapeJobStatusEnum("status").default("pending").notNull(),
    payload: jsonb("payload").$type<ScrapeJobPayload>().notNull(),
    result: jsonb("result").$type<ScrapeJobResult | null>(),
    errorMessage: text("errorMessage"),
    requestedByUserId: integer("requestedByUserId").references(() => users.id),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("maxAttempts").default(1).notNull(),
    lockedBy: varchar("lockedBy", { length: 255 }),
    availableAt: timestamp("availableAt", { mode: "date" }).defaultNow().notNull(),
    startedAt: timestamp("startedAt", { mode: "date" }),
    completedAt: timestamp("completedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    statusAvailableIdx: index("scrape_jobs_status_available_idx").on(table.status, table.availableAt),
    createdAtIdx: index("scrape_jobs_created_at_idx").on(table.createdAt),
    requestedByIdx: index("scrape_jobs_requested_by_idx").on(table.requestedByUserId),
  }),
);

export type ScrapeJob = typeof scrapeJobs.$inferSelect;
export type InsertScrapeJob = typeof scrapeJobs.$inferInsert;
