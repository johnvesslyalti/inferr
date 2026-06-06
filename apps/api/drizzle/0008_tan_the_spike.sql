CREATE TABLE "market_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roles" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
