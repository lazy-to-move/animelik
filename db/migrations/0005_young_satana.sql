ALTER TABLE "anime" ADD COLUMN "coverImageSource" varchar(50);--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "bannerImageSource" varchar(50);--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "metadataSource" varchar(50);--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "seasonNumber" integer;--> statement-breakpoint
UPDATE "anime"
SET "coverImageSource" = CASE
  WHEN "coverImage" LIKE '/anime-covers/%' THEN 'legacy_disk'
  WHEN "coverImage" LIKE 'http%' THEN 'legacy_remote'
  ELSE NULL
END
WHERE "coverImageSource" IS NULL;--> statement-breakpoint
UPDATE "anime"
SET "bannerImageSource" = CASE
  WHEN "bannerImage" LIKE '/anime-covers/%' THEN 'legacy_disk'
  WHEN "bannerImage" LIKE 'http%' THEN 'legacy_remote'
  ELSE NULL
END
WHERE "bannerImageSource" IS NULL;--> statement-breakpoint
UPDATE "anime"
SET "metadataSource" = CASE
  WHEN "externalId" IS NOT NULL THEN 'legacy'
  WHEN "sourceSite" IS NOT NULL THEN 'source_site'
  ELSE 'legacy'
END
WHERE "metadataSource" IS NULL;
