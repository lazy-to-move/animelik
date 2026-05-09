CREATE TYPE "public"."anime_status" AS ENUM('ongoing', 'completed', 'upcoming');--> statement-breakpoint
CREATE TYPE "public"."anime_type" AS ENUM('tv', 'movie', 'ova', 'special');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."watchlist_status" AS ENUM('watching', 'completed', 'plan_to_watch', 'dropped');