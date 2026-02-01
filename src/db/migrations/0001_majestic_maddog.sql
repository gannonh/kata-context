CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
ALTER TABLE "contexts" DROP CONSTRAINT "contexts_parent_id_contexts_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_context_id_contexts_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "role" SET DATA TYPE "public"."message_role" USING "role"::"public"."message_role";--> statement-breakpoint
ALTER TABLE "contexts" ADD CONSTRAINT "contexts_parent_id_contexts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE cascade ON UPDATE no action;