import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { contexts, type Message, messages } from "../db/schema/index.js";
import { type Database, handleDatabaseError, notDeleted } from "./helpers.js";
import type {
  AppendMessageInput,
  PaginatedResult,
  PaginationOptions,
  TokenBudgetOptions,
} from "./types.js";
import { RepositoryError } from "./types.js";

// Maximum allowed limit for pagination to prevent abuse
const MAX_PAGINATION_LIMIT = 1000;

export class MessageRepository {
  constructor(private db: Database) {}

  // DATA-03: Append messages to context (batch insert with sequence assignment)
  // Uses transaction with FOR UPDATE to prevent race conditions
  async append(contextId: string, newMessages: AppendMessageInput[]): Promise<Message[]> {
    if (newMessages.length === 0) {
      return [];
    }

    try {
      return await this.db.transaction(async (tx) => {
        // Lock context row and get current latest version
        const [context] = await tx
          .select({
            id: contexts.id,
            latestVersion: contexts.latestVersion,
          })
          .from(contexts)
          .where(and(eq(contexts.id, contextId), notDeleted(contexts)))
          .for("update");

        if (!context) {
          throw new RepositoryError(`Context not found: ${contextId}`, "NOT_FOUND");
        }

        // Assign sequential versions starting after current latest
        let nextVersion = context.latestVersion;
        const messagesWithVersions = newMessages.map((msg) => ({
          contextId,
          version: ++nextVersion,
          role: msg.role,
          content: msg.content,
          tokenCount: msg.tokenCount ?? null,
          toolCallId: msg.toolCallId ?? null,
          toolName: msg.toolName ?? null,
          model: msg.model ?? null,
        }));

        // Batch insert all messages
        const inserted = await tx.insert(messages).values(messagesWithVersions).returning();

        // Calculate total new tokens (null-safe)
        const totalNewTokens = inserted.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0);

        // Atomically update context counters
        await tx
          .update(contexts)
          .set({
            messageCount: sql`${contexts.messageCount} + ${inserted.length}`,
            totalTokens: sql`${contexts.totalTokens} + ${totalNewTokens}`,
            latestVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(contexts.id, contextId));

        return inserted;
      });
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      handleDatabaseError(error);
      throw error; // TypeScript safety: handleDatabaseError always throws, but this ensures all paths throw
    }
  }

  // DATA-04: Retrieve messages with cursor-based pagination
  async findByContext(
    contextId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<Message>> {
    try {
      // Check if context exists and is not soft-deleted
      const [context] = await this.db
        .select({ id: contexts.id })
        .from(contexts)
        .where(and(eq(contexts.id, contextId), notDeleted(contexts)))
        .limit(1);

      if (!context) {
        return { data: [], nextCursor: null, hasMore: false };
      }

      const { cursor, limit: requestedLimit = 50, order = "asc" } = options;

      // Cap limit to prevent abuse
      const limit = Math.min(requestedLimit, MAX_PAGINATION_LIMIT);

      // Fetch one extra to determine if there are more
      const fetchLimit = limit + 1;

      // Build where conditions
      const conditions = [eq(messages.contextId, contextId), notDeleted(messages)];

      // Add cursor condition if provided
      if (cursor !== undefined) {
        conditions.push(
          order === "asc" ? gt(messages.version, cursor) : lt(messages.version, cursor),
        );
      }

      const results = await this.db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(order === "asc" ? asc(messages.version) : desc(messages.version))
        .limit(fetchLimit);

      const hasMore = results.length > limit;
      const data = hasMore ? results.slice(0, limit) : results;
      const lastItem = data[data.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.version : null;

      return { data, nextCursor, hasMore };
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }

  // DATA-06: Token-budgeted windowing (retrieve last N tokens worth of messages)
  // Returns messages in chronological order (oldest first)
  async getByTokenBudget(contextId: string, options: TokenBudgetOptions): Promise<Message[]> {
    const { budget } = options;

    // Validate budget: must be a finite positive number
    if (!Number.isFinite(budget) || budget <= 0) {
      return [];
    }

    try {
      // Check if context exists and is not soft-deleted
      const [context] = await this.db
        .select({ id: contexts.id })
        .from(contexts)
        .where(and(eq(contexts.id, contextId), notDeleted(contexts)))
        .limit(1);

      if (!context) {
        return [];
      }

      // Fetch messages newest-first to find the window
      const allMessages = await this.db
        .select()
        .from(messages)
        .where(and(eq(messages.contextId, contextId), notDeleted(messages)))
        .orderBy(desc(messages.version));

      // Accumulate until budget exceeded
      const result: Message[] = [];
      let tokensUsed = 0;

      for (const msg of allMessages) {
        const msgTokens = msg.tokenCount ?? 0;

        // Always include at least one message, then check budget
        if (tokensUsed + msgTokens > budget && result.length > 0) {
          break;
        }

        result.push(msg);
        tokensUsed += msgTokens;
      }

      // Return in chronological order (oldest first)
      return result.reverse();
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }

  // Helper: Get single message by context and version
  async findByVersion(contextId: string, version: number): Promise<Message | null> {
    try {
      const [message] = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.contextId, contextId),
            eq(messages.version, version),
            notDeleted(messages),
          ),
        );

      return message ?? null;
    } catch (error) {
      handleDatabaseError(error);
      throw error;
    }
  }
}
