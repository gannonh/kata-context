ALTER TABLE "contexts" ADD COLUMN "policy_config" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "compacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "compacted_into_version" bigint;