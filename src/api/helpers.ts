/**
 * Extracts a context ID (UUID) from a URL pathname
 *
 * @param pathname - URL pathname (e.g., "/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages")
 * @returns The extracted UUID or null if not found
 *
 * @example
 * extractContextId("/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000");
 * // Returns: "123e4567-e89b-12d3-a456-426614174000"
 *
 * extractContextId("/api/v1/contexts/invalid");
 * // Returns: "invalid" (caller should validate with isValidUUID)
 */
export function extractContextId(pathname: string): string | null {
  const match = pathname.match(/\/api\/v1\/contexts\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * UUID regex pattern supporting versions 1-7
 * Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
 * - M (version): 1-7
 * - N (variant): 8, 9, a, or b
 * - Case-insensitive hex characters
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a valid UUID (v1-7)
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Extracts and validates a context ID from a request URL.
 * Returns the validated ID or an error Response.
 */
export function requireContextId(request: Request): string | Response {
  const url = new URL(request.url);
  const id = extractContextId(url.pathname);

  if (!id) {
    return errorResponse(400, "Invalid request", "Context ID required in URL path");
  }

  if (!isValidUUID(id)) {
    return errorResponse(400, "Invalid UUID", `"${id}" is not a valid UUID format`);
  }

  return id;
}

/**
 * Safely parses JSON from a Request body
 *
 * @param request - The incoming Request object
 * @returns Parsed JSON body or null if parsing fails
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch (error) {
    console.warn("[parseJsonBody] Failed to parse request body:", error);
    return null;
  }
}

// Import here to avoid circular dependency (errorResponse is used by requireContextId)
import { errorResponse } from "./errors.js";
