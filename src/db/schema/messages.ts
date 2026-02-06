import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { contexts } from "./contexts.js";

// Message roles - enforced at database level via pgEnum
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system", "tool"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // CASCADE delete: when context is deleted, all its messages are deleted
    contextId: uuid("context_id")
      .notNull()
      .references(() => contexts.id, { onDelete: "cascade" }),
    version: bigint("version", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name"),
    tokenCount: integer("token_count"),
    model: text("model"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    compactedAt: timestamp("compacted_at", { withTimezone: true }),
    compactedIntoVersion: bigint("compacted_into_version", { mode: "number" }),
    // pgvector column for semantic search (v0.3.0+)
    // 1536 dimensions = OpenAI text-embedding-3-small
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [
    // Index for efficient message retrieval by context and version order
    index("messages_context_version_idx").on(table.contextId, table.version),
    // Index for soft delete filtering
    index("messages_deleted_at_idx").on(table.deletedAt),
    // Unique constraint: one version per context
    unique("messages_context_version_unique").on(table.contextId, table.version),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
