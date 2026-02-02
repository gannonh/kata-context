import type { Context, Message, NewContext, NewMessage } from "../db/schema/index.js";

// Input types - what callers provide (excludes auto-generated fields)
export type CreateContextInput = Pick<NewContext, "name"> & {
  metadata?: Record<string, unknown>; // Future: stored in separate column
};

// Result types - what repository returns
export type ContextWithMessageCount = Context; // messageCount already in schema

// Pagination
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: number | null;
  hasMore: boolean;
}

// Error handling
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: "DUPLICATE" | "NOT_FOUND" | "FOREIGN_KEY" | "DATABASE_ERROR",
    public readonly constraint?: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

// Re-export schema types for convenience
export type { Context, Message, NewContext, NewMessage };
