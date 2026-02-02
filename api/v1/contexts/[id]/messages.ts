import {
  appendMessagesSchema,
  errorResponse,
  extractContextId,
  isValidUUID,
  paginationSchema,
  parseJsonBody,
  successResponse,
} from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { MessageRepository, RepositoryError } from "../../../../src/repositories/index.js";

// Singleton repository instance for serverless function lifecycle
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
    // Extract and validate context ID
    const url = new URL(request.url);
    const contextId = extractContextId(url.pathname);

    if (!contextId) {
      return errorResponse(400, "Invalid request", "Missing context ID in URL");
    }

    if (!isValidUUID(contextId)) {
      return errorResponse(400, "Invalid request", "Context ID must be a valid UUID");
    }

    // Parse JSON body
    const body = await parseJsonBody(request);
    if (body === null) {
      return errorResponse(400, "Invalid JSON", "Request body must be valid JSON");
    }

    // Validate request body
    const result = appendMessagesSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    // Append messages via repository
    const messages = await repository.append(contextId, result.data.messages);

    return successResponse(201, { data: messages });
  } catch (error) {
    // Handle known repository errors
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return errorResponse(404, "Context not found");
      }
    }

    // Log full error for server-side observability
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
    // Extract and validate context ID
    const url = new URL(request.url);
    const contextId = extractContextId(url.pathname);

    if (!contextId) {
      return errorResponse(400, "Invalid request", "Missing context ID in URL");
    }

    if (!isValidUUID(contextId)) {
      return errorResponse(400, "Invalid request", "Context ID must be a valid UUID");
    }

    // Parse query parameters
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = url.searchParams.get("limit") ?? undefined;
    const order = url.searchParams.get("order") ?? undefined;

    // Validate pagination params
    const result = paginationSchema.safeParse({ cursor, limit, order });
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    // Fetch messages via repository
    // Note: findByContext returns empty array for non-existent context (not error)
    const paginatedResult = await repository.findByContext(contextId, result.data);

    return successResponse(200, paginatedResult);
  } catch (error) {
    // Log full error for server-side observability
    console.error("[GET /api/v1/contexts/:id/messages] Unexpected error:", error);

    return errorResponse(500, "Internal server error");
  }
}
