import { z } from "zod/v4";

/**
 * Schema for creating a new context
 * Matches CreateContextInput from repositories/types.ts
 */
export const createContextSchema = z.object({
  name: z.string().max(255).optional(),
});

export type CreateContextSchemaInput = z.infer<typeof createContextSchema>;

/**
 * Schema for a single message in the append request
 * Matches AppendMessageInput from repositories/types.ts
 */
const messageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
    tokenCount: z.number().int().positive().optional(),
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    model: z.string().optional(),
  })
  .refine((msg) => msg.role !== "tool" || msg.toolCallId, {
    message: "toolCallId is required when role is 'tool'",
    path: ["toolCallId"],
  });

/**
 * Schema for appending messages to a context
 * Requires at least one message in the array
 */
export const appendMessagesSchema = z.object({
  messages: z.array(messageSchema).min(1, "At least one message required"),
});

export type AppendMessagesSchemaInput = z.infer<typeof appendMessagesSchema>;

/**
 * Schema for pagination query parameters
 * Uses coercion for query string values (strings -> numbers)
 */
export const paginationSchema = z.object({
  cursor: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type PaginationSchemaInput = z.infer<typeof paginationSchema>;

/**
 * Schema for token budget query parameter
 * Requires a positive integer budget value
 */
export const tokenBudgetSchema = z.object({
  budget: z.coerce.number().int().positive("Budget must be a positive integer"),
});

export type TokenBudgetSchemaInput = z.infer<typeof tokenBudgetSchema>;
