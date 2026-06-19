CREATE TABLE "cron_locks" (
	"job_name" varchar(255) PRIMARY KEY NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL
);
