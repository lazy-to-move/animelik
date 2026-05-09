CREATE TABLE "episodeBrokenReports" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"animeId" integer NOT NULL,
	"episodeId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodeBrokenReports" ADD CONSTRAINT "episodeBrokenReports_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodeBrokenReports" ADD CONSTRAINT "episodeBrokenReports_animeId_anime_id_fk" FOREIGN KEY ("animeId") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodeBrokenReports" ADD CONSTRAINT "episodeBrokenReports_episodeId_episodes_id_fk" FOREIGN KEY ("episodeId") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_broken_reports_user_created_idx" ON "episodeBrokenReports" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "episode_broken_reports_episode_created_idx" ON "episodeBrokenReports" USING btree ("episodeId","createdAt");--> statement-breakpoint
CREATE INDEX "episode_broken_reports_anime_created_idx" ON "episodeBrokenReports" USING btree ("animeId","createdAt");