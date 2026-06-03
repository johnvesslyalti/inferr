DROP TABLE IF EXISTS "jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;