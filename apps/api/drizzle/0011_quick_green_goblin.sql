CREATE TABLE "ai_evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"faithfulness" real NOT NULL,
	"answer_relevance" real NOT NULL,
	"context_recall" real NOT NULL,
	"evaluated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_evaluations_user_id_idx" ON "ai_evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_evaluations_evaluated_at_idx" ON "ai_evaluations" USING btree ("evaluated_at");