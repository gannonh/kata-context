import {
  appendMessagesSchema,
  errorResponse,
  paginationSchema,
  parseJsonBody,
  requireContextId,
  successResponse,
} from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { MessageRepository, RepositoryError } from "../../../../src/repositories/index.js";

const repository = new MessageRepository(db);

/**
 * POST /api/v1/contexts/:id/messages
 * Appends messages to a context
 *
 * Request body: { messages: [{ role, content, tokenCount?, ... }] }
 * Response: 201 with appended messages
 *
 * Requirement: API-04
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const contextId = requireContextId(request);
    if (contextId instanceof Response) return contextId;

    const body = await parseJsonBody(request);
    if (body === null) {
      return errorResponse(400, "Invalid JSON", "Request body must be valid JSON");
    }

    const result = appendMessagesSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    const messages = await repository.append(contextId, result.data.messages);
    return successResponse(201, { data: messages });
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return errorResponse(404, "Context not found");
      }
      return errorResponse(500, "Database error", error.message);
    }
    console.error("[POST /api/v1/contexts/:id/messages] Unexpected error:", error);
    return errorResponse(500, "Internal server error");
  }
}

/**
 * GET /api/v1/contexts/:id/messages
 * Retrieves messages from a context with cursor-based pagination
 *
 * Query params: cursor?, limit?, order?
 * Response: 200 with { data, nextCursor, hasMore }
 *
 * Requirement: API-05
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const contextId = requireContextId(request);
    if (contextId instanceof Response) return contextId;

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = url.searchParams.get("limit") ?? undefined;
    const order = url.searchParams.get("order") ?? undefined;

    const result = paginationSchema.safeParse({ cursor, limit, order });
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    const paginatedResult = await repository.findByContext(contextId, result.data);
    return successResponse(200, paginatedResult);
  } catch (error) {
    if (error instanceof RepositoryError) {
      return errorResponse(500, "Database error", error.message);
    }
    console.error("[GET /api/v1/contexts/:id/messages] Unexpected error:", error);
    return errorResponse(500, "Internal server error");
  }
}
