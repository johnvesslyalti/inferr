CREATE TABLE IF NOT EXISTS "cron_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_name" varchar(255) NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "error" text
);

CREATE INDEX IF NOT EXISTS "idx_cron_runs_job_name" ON "cron_runs" ("job_name", "started_at" DESC);
