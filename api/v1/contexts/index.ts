import {
  createContextSchema,
  errorResponse,
  parseJsonBody,
  successResponse,
} from "../../../src/api/index.js";
import { db } from "../../../src/db/client.js";
import { ContextRepository } from "../../../src/repositories/index.js";

// Singleton repository instance for serverless function lifecycle
const repository = new ContextRepository(db);

/**
 * POST /api/v1/contexts
 * Creates a new context with optional name
 *
 * Request body: { name?: string }
 * Response: 201 with created context data
 *
 * Requirement: API-01
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Parse JSON body
    const body = await parseJsonBody(request);
    if (body === null) {
      return errorResponse(400, "Invalid JSON", "Request body must be valid JSON");
    }

    // Validate request body
    const result = createContextSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    // Create context via repository
    const context = await repository.create(result.data);

    return successResponse(201, { data: context });
  } catch (error) {
    // Log full error for server-side observability
    console.error("[POST /api/v1/contexts] Unexpected error:", error);

    return errorResponse(500, "Internal server error");
  }
}
