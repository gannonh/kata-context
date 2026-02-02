import type { Context, Message, NewContext, NewMessage } from "../db/schema/index.js";

// Input types - what callers provide (excludes auto-generated fields)
export type CreateContextInput = Pick<NewContext, "name"> & {
  metadata?: Record<string, unknown>; // Future: stored in separate column
};

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

// Message input - what callers provide when appending messages
export type AppendMessageInput = Pick<NewMessage, "role" | "content" | "tokenCount"> & {
  toolCallId?: string;
  toolName?: string;
  model?: string;
};

// Pagination options
export interface PaginationOptions {
  cursor?: number; // version to start after
  limit?: number; // max messages to return (default 50)
  order?: "asc" | "desc"; // version order (default 'asc')
}

// Token budget options
export interface TokenBudgetOptions {
  budget: number; // max tokens to include
}

// Re-export schema types for convenience
export type { Context, Message, NewContext, NewMessage };
