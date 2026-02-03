import { errorResponse, requireContextId, successResponse } from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { ContextRepository, RepositoryError } from "../../../../src/repositories/index.js";

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
    const id = requireContextId(request);
    if (id instanceof Response) return id;

    const context = await repository.findById(id);
    if (!context) {
      return errorResponse(404, "Context not found", `No context found with ID: ${id}`);
    }

    return successResponse(200, { data: context });
  } catch (error) {
    if (error instanceof RepositoryError) {
      return errorResponse(500, "Database error", error.message);
    }
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
    const id = requireContextId(request);
    if (id instanceof Response) return id;

    const context = await repository.softDelete(id);
    if (!context) {
      return errorResponse(404, "Context not found", `No context found with ID: ${id}`);
    }

    return successResponse(200, { data: context });
  } catch (error) {
    if (error instanceof RepositoryError) {
      return errorResponse(500, "Database error", error.message);
    }
    console.error("[DELETE /api/v1/contexts/:id] Unexpected error:", error);
    return errorResponse(500, "Internal server error");
  }
}
