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
  // Match /api/v1/contexts/{id}/... or /api/v1/contexts/{id}
  const match = pathname.match(/\/api\/v1\/contexts\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * UUID regex pattern supporting versions 1-7
 * Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
 * - M (version): 1-7
 * - N (variant): 8, 9, a, or b
 * - All lowercase hex characters
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a valid UUID (v1-7)
 *
 * @param str - String to validate
 * @returns true if valid UUID format, false otherwise
 *
 * @example
 * isValidUUID("123e4567-e89b-12d3-a456-426614174000"); // true
 * isValidUUID("not-a-uuid"); // false
 * isValidUUID(""); // false
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Safely parses JSON from a Request body
 *
 * @param request - The incoming Request object
 * @returns Parsed JSON body or null if parsing fails
 *
 * @example
 * const body = await parseJsonBody<{ name: string }>(request);
 * if (!body) {
 *   return errorResponse(400, "Invalid JSON");
 * }
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
