import {
  errorResponse,
  extractContextId,
  isValidUUID,
  successResponse,
} from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { ContextRepository } from "../../../../src/repositories/index.js";

// Singleton repository instance for serverless function lifecycle
const repository = new ContextRepository(db);

/**
 * GET /api/v1/contexts/:id
 * Retrieves a context by its UUID
 *
 * Response: 200 with context data, 400 for invalid UUID, 404 if not found
 *
 * Requirement: API-02
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const id = extractContextId(url.pathname);

    if (!id) {
      return errorResponse(400, "Invalid request", "Context ID required in URL path");
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return errorResponse(400, "Invalid UUID", `"${id}" is not a valid UUID format`);
    }

    // Fetch context from repository
    const context = await repository.findById(id);

    if (!context) {
      return errorResponse(404, "Context not found", `No context found with ID: ${id}`);
    }

    return successResponse(200, { data: context });
  } catch (error) {
    // Log full error for server-side observability
    console.error("[GET /api/v1/contexts/:id] Unexpected error:", error);

    return errorResponse(500, "Internal server error");
  }
}

/**
 * DELETE /api/v1/contexts/:id
 * Soft-deletes a context by its UUID (sets deletedAt timestamp)
 *
 * Response: 200 with soft-deleted context, 400 for invalid UUID, 404 if not found
 *
 * Requirement: API-03
 */
export async function DELETE(request: Request): Promise<Response> {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const id = extractContextId(url.pathname);

    if (!id) {
      return errorResponse(400, "Invalid request", "Context ID required in URL path");
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return errorResponse(400, "Invalid UUID", `"${id}" is not a valid UUID format`);
    }

    // Soft delete context via repository
    const context = await repository.softDelete(id);

    if (!context) {
      return errorResponse(404, "Context not found", `No context found with ID: ${id}`);
    }

    return successResponse(200, { data: context });
  } catch (error) {
    // Log full error for server-side observability
    console.error("[DELETE /api/v1/contexts/:id] Unexpected error:", error);

    return errorResponse(500, "Internal server error");
  }
}
