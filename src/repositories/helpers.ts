import { type Column, isNull, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import pg from "pg";
import type * as schema from "../db/schema/index.js";

// Handle ESM/CJS interop for pg module
const { DatabaseError } = pg;

import { RepositoryError } from "./types.js";

// Support both production (node-postgres) and test (pglite) database types
export type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

/**
 * Soft delete filter - use with every query that should exclude deleted records
 *
 * @example
 * await db.select().from(contexts).where(notDeleted(contexts));
 */
export const notDeleted = <T extends { deletedAt: Column }>(table: T): SQL =>
  isNull(table.deletedAt);

/**
 * PostgreSQL error code handler
 * Maps PostgreSQL error codes to domain-specific RepositoryError types.
 *
 * Common error codes:
 * - 23505: unique_violation
 * - 23503: foreign_key_violation
 */
export function handleDatabaseError(error: unknown): never {
  const pgError = (error as { cause?: unknown })?.cause;

  if (pgError instanceof DatabaseError) {
    switch (pgError.code) {
      case "23505": // unique_violation
        throw new RepositoryError("Duplicate entry", "DUPLICATE", pgError.constraint ?? undefined);
      case "23503": // foreign_key_violation
        throw new RepositoryError(
          "Referenced record not found",
          "FOREIGN_KEY",
          pgError.constraint ?? undefined,
        );
      default:
        throw new RepositoryError(`Database error: ${pgError.message}`, "DATABASE_ERROR");
    }
  }

  // Re-throw unknown errors
  throw error;
}
