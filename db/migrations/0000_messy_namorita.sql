CREATE TYPE "public"."anime_status" AS ENUM('ongoing', 'completed', 'upcoming');
--> statement-breakpoint
CREATE TYPE "public"."anime_type" AS ENUM('tv', 'movie', 'ova', 'special');
--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');
--> statement-breakpoint
CREATE TYPE "public"."watchlist_status" AS ENUM('watching', 'completed', 'plan_to_watch', 'dropped');
--> statement-breakpoint
CREATE TABLE "anime" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"titleEnglish" varchar(255),
	"titleJp" varchar(255),
	"titleSynonyms" jsonb,
	"slug" varchar(255) NOT NULL,
	"synopsis" text NOT NULL,
	"coverImage" varchar(500),
	"bannerImage" varchar(500),
	"status" "anime_status" DEFAULT 'upcoming',
	"type" "anime_type" DEFAULT 'tv',
	"rating" varchar(10),
	"releaseYear" integer,
	"studio" varchar(100),
	"score" numeric(3, 2) DEFAULT '0.00',
	"episodesCount" integer DEFAULT 0,
	"duration" integer,
	"featured" boolean DEFAULT false,
	"categoryId" integer,
	"externalId" varchar(255),
	"externalSlug" varchar(255),
	"sourceSite" varchar(50),
	"broadcastDay" varchar(20),
	"broadcastTime" varchar(10),
	"broadcastTimezone" varchar(64),
	"broadcastText" varchar(120),
	"broadcastFetchedAt" timestamp,
	"lastScrapedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anime_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "animeGenres" (
	"id" serial PRIMARY KEY NOT NULL,
	"animeId" integer NOT NULL,
	"categoryId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"animeId" integer NOT NULL,
	"number" integer NOT NULL,
	"title" varchar(255),
	"synopsis" text,
	"thumbnail" varchar(500),
	"videoUrl" varchar(500),
	"videoSources" jsonb,
	"duration" integer,
	"airDate" date,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"animeId" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"unionId" varchar(255) NOT NULL,
	"googleId" varchar(255),
	"name" varchar(255),
	"email" varchar(320),
	"passwordHash" varchar(255),
	"avatar" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignInAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_unionId_unique" UNIQUE("unionId"),
	CONSTRAINT "users_googleId_unique" UNIQUE("googleId")
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"animeId" integer NOT NULL,
	"status" "watchlist_status" DEFAULT 'watching',
	"currentEpisode" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anime" ADD CONSTRAINT "anime_categoryId_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animeGenres" ADD CONSTRAINT "animeGenres_animeId_anime_id_fk" FOREIGN KEY ("animeId") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animeGenres" ADD CONSTRAINT "animeGenres_categoryId_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_animeId_anime_id_fk" FOREIGN KEY ("animeId") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_animeId_anime_id_fk" FOREIGN KEY ("animeId") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_animeId_anime_id_fk" FOREIGN KEY ("animeId") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;
