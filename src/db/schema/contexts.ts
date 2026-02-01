import {
  type AnyPgColumn,
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const contexts = pgTable("contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  messageCount: integer("message_count").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latestVersion: bigint("latest_version", { mode: "number" }).notNull().default(0),
  // Self-reference for fork tracking - using AnyPgColumn to avoid circular type inference
  parentId: uuid("parent_id").references((): AnyPgColumn => contexts.id),
  forkVersion: bigint("fork_version", { mode: "number" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Context = typeof contexts.$inferSelect;
export type NewContext = typeof contexts.$inferInsert;
