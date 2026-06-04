CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"company" varchar(255),
	"category" varchar(255),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"job_type" varchar(100),
	"location" varchar(255),
	"salary" varchar(255),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE INDEX "jobs_category_idx" ON "jobs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "jobs_published_at_idx" ON "jobs" USING btree ("published_at");