CREATE TYPE "public"."scrape_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scrape_job_type" AS ENUM('import_from_source', 'sync_all_episodes', 'refresh_anime_metadata');--> statement-breakpoint
CREATE TABLE "scrapeJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "scrape_job_type" NOT NULL,
	"status" "scrape_job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"errorMessage" text,
	"requestedByUserId" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 1 NOT NULL,
	"lockedBy" varchar(255),
	"availableAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrapeJobs" ADD CONSTRAINT "scrapeJobs_requestedByUserId_users_id_fk" FOREIGN KEY ("requestedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scrape_jobs_status_available_idx" ON "scrapeJobs" USING btree ("status","availableAt");--> statement-breakpoint
CREATE INDEX "scrape_jobs_created_at_idx" ON "scrapeJobs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "scrape_jobs_requested_by_idx" ON "scrapeJobs" USING btree ("requestedByUserId");