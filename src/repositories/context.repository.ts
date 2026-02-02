import { and, eq } from "drizzle-orm";
import { type Context, contexts } from "../db/schema/index.js";
import { type Database, handleDatabaseError, notDeleted } from "./helpers.js";
import type { CreateContextInput } from "./types.js";

export class ContextRepository {
  constructor(private db: Database) {}

  /**
   * DATA-01: Create new context with optional name
   * Auto-generates: id, createdAt, updatedAt, messageCount, totalTokens, latestVersion
   */
  async create(input: CreateContextInput): Promise<Context> {
    try {
      const result = await this.db
        .insert(contexts)
        .values({
          name: input.name ?? null,
        })
        .returning();

      // Insert with returning() always returns the inserted row
      const context = result[0];
      if (!context) {
        throw new Error("Insert failed to return context");
      }

      return context;
    } catch (error) {
      handleDatabaseError(error);
      throw error; // TypeScript safety: handleDatabaseError always throws, but this ensures all paths throw
    }
  }

  /**
   * DATA-02: Retrieve context by ID (excludes soft-deleted)
   */
  async findById(id: string): Promise<Context | null> {
    try {
      const [context] = await this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.id, id), notDeleted(contexts)));

      return context ?? null;
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }

  /**
   * DATA-05: Soft delete context (preserves history)
   * Sets deletedAt timestamp instead of removing record
   */
  async softDelete(id: string): Promise<Context | null> {
    try {
      const [context] = await this.db
        .update(contexts)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(contexts.id, id),
            notDeleted(contexts), // Can't delete already-deleted
          ),
        )
        .returning();

      return context ?? null;
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }

  /**
   * Helper: Check if context exists and is not deleted
   * Used by MessageRepository to validate contextId
   */
  async exists(id: string): Promise<boolean> {
    try {
      const context = await this.findById(id);
      return context !== null;
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }
}
