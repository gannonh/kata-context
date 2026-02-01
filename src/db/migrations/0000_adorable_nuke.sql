CREATE TABLE "contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"latest_version" bigint DEFAULT 0 NOT NULL,
	"parent_id" uuid,
	"fork_version" bigint,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_call_id" text,
	"tool_name" text,
	"token_count" integer,
	"model" text,
	"deleted_at" timestamp with time zone,
	"embedding" vector(1536),
	CONSTRAINT "messages_context_version_unique" UNIQUE("context_id","version")
);
--> statement-breakpoint
ALTER TABLE "contexts" ADD CONSTRAINT "contexts_parent_id_contexts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contexts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_context_version_idx" ON "messages" USING btree ("context_id","version");--> statement-breakpoint
CREATE INDEX "messages_deleted_at_idx" ON "messages" USING btree ("deleted_at");