import {
  errorResponse,
  requireContextId,
  successResponse,
  tokenBudgetSchema,
} from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { MessageRepository, RepositoryError } from "../../../../src/repositories/index.js";

const repository = new MessageRepository(db);

/**
 * GET /api/v1/contexts/:id/window
 * Retrieves messages fitting within a token budget
 *
 * Query params: budget (required)
 * Response: 200 with { data: messages[] }
 *
 * Edge cases (handled by repository):
 * - Non-existent context returns empty array
 * - Budget exceeds total tokens returns all messages
 * - Zero/negative budget returns empty array
 *
 * Requirement: API-06, TEST-03
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const contextId = requireContextId(request);
    if (contextId instanceof Response) return contextId;

    const url = new URL(request.url);
    const budget = url.searchParams.get("budget") ?? undefined;

    const result = tokenBudgetSchema.safeParse({ budget });
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    const messages = await repository.getByTokenBudget(contextId, {
      budget: result.data.budget,
    });

    return successResponse(200, { data: messages });
  } catch (error) {
    if (error instanceof RepositoryError) {
      return errorResponse(500, "Database error", error.message);
    }
    console.error("[GET /api/v1/contexts/:id/window] Unexpected error:", error);
    return errorResponse(500, "Internal server error");
  }
}
