ALTER TABLE "anime" ALTER COLUMN "score" SET DATA TYPE numeric(4, 2);--> statement-breakpoint
ALTER TABLE "anime" ALTER COLUMN "score" SET DEFAULT '0.00';--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_anime_unique" ON "reviews" USING btree ("userId","animeId");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_anime_unique" ON "watchlist" USING btree ("userId","animeId");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");