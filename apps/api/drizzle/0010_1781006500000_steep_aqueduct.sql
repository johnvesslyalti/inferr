CREATE TABLE "mcp_clients" (
	"client_id" varchar(255) PRIMARY KEY NOT NULL,
	"client_info" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_auth_codes" (
	"code" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"code_challenge" varchar(255) NOT NULL,
	"redirect_uri" varchar(2048) NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_mcp_authorizations" (
	"state" varchar(255) PRIMARY KEY NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"code_challenge" varchar(255) NOT NULL,
	"redirect_uri" varchar(2048) NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"client_state" varchar(2048),
	"expires_at" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_auth_codes" ADD CONSTRAINT "pending_auth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;