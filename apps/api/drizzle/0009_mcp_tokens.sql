CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"replaced_by_hash" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_tokens_token_hash_idx" ON "mcp_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mcp_tokens_user_id_idx" ON "mcp_tokens" USING btree ("user_id");
