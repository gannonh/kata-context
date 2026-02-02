import {
  errorResponse,
  extractContextId,
  isValidUUID,
  successResponse,
  tokenBudgetSchema,
} from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { MessageRepository } from "../../../../src/repositories/index.js";

// Singleton repository instance for serverless function lifecycle
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
    // Extract and validate context ID
    const url = new URL(request.url);
    const contextId = extractContextId(url.pathname);

    if (!contextId) {
      return errorResponse(400, "Invalid request", "Missing context ID in URL");
    }

    if (!isValidUUID(contextId)) {
      return errorResponse(400, "Invalid request", "Context ID must be a valid UUID");
    }

    // Parse budget query parameter
    const budget = url.searchParams.get("budget") ?? undefined;

    // Validate budget param (required)
    const result = tokenBudgetSchema.safeParse({ budget });
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    // Fetch messages within token budget via repository
    // Note: returns empty array for non-existent context (not error)
    const messages = await repository.getByTokenBudget(contextId, {
      budget: result.data.budget,
    });

    return successResponse(200, { data: messages });
  } catch (error) {
    // Log full error for server-side observability
    console.error("[GET /api/v1/contexts/:id/window] Unexpected error:", error);

    return errorResponse(500, "Internal server error");
  }
}
