import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  decimal,
  boolean,
  date,
  json,
} from "drizzle-orm/mysql-core";
import type { SourceSiteId } from "../api/services/scraper/types";

export type EpisodeVideoSource = {
  server: string;
  quality: "sd" | "hd" | "fhd";
  url: string;
};

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = mysqlTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export const anime = mysqlTable("anime", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  titleJp: varchar("titleJp", { length: 255 }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  synopsis: text("synopsis").notNull(),
  coverImage: varchar("coverImage", { length: 500 }),
  bannerImage: varchar("bannerImage", { length: 500 }),
  status: mysqlEnum("status", ["ongoing", "completed", "upcoming"]).default("upcoming"),
  type: mysqlEnum("type", ["tv", "movie", "ova", "special"]).default("tv"),
  rating: varchar("rating", { length: 10 }),
  releaseYear: int("releaseYear"),
  studio: varchar("studio", { length: 100 }),
  score: decimal("score", { precision: 3, scale: 2 }).default("0.00"),
  episodesCount: int("episodesCount").default(0),
  duration: int("duration"),
  featured: boolean("featured").default(false),
  categoryId: bigint("categoryId", { mode: "number", unsigned: true }).references(() => categories.id),
  externalId: varchar("externalId", { length: 255 }),
  externalSlug: varchar("externalSlug", { length: 255 }),
  sourceSite: varchar("sourceSite", { length: 50 }).$type<SourceSiteId | null>(),
  lastScrapedAt: timestamp("lastScrapedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Anime = typeof anime.$inferSelect;
export type InsertAnime = typeof anime.$inferInsert;

export const episodes = mysqlTable("episodes", {
  id: serial("id").primaryKey(),
  animeId: bigint("animeId", { mode: "number", unsigned: true }).notNull().references(() => anime.id),
  number: int("number").notNull(),
  title: varchar("title", { length: 255 }),
  synopsis: text("synopsis"),
  thumbnail: varchar("thumbnail", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),
  videoSources: json("videoSources").$type<EpisodeVideoSource[] | null>(),
  duration: int("duration"),
  airDate: date("airDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

export const watchlist = mysqlTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  animeId: bigint("animeId", { mode: "number", unsigned: true }).notNull().references(() => anime.id),
  status: mysqlEnum("status", ["watching", "completed", "plan_to_watch", "dropped"]).default("watching"),
  currentEpisode: int("currentEpisode").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = typeof watchlist.$inferInsert;

export const reviews = mysqlTable("reviews", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  animeId: bigint("animeId", { mode: "number", unsigned: true }).notNull().references(() => anime.id),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;
