DO $$
BEGIN
	CREATE TYPE "public"."anime_status" AS ENUM('ongoing', 'completed', 'upcoming');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."anime_type" AS ENUM('tv', 'movie', 'ova', 'special');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."role" AS ENUM('user', 'admin');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."watchlist_status" AS ENUM('watching', 'completed', 'plan_to_watch', 'dropped');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
