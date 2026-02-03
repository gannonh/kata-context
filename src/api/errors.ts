/**
 * RFC 9457 Problem Details response format
 * @see https://datatracker.ietf.org/doc/rfc9457/
 */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: unknown;
}

/**
 * Creates an RFC 9457-compliant error response
 *
 * @param status - HTTP status code
 * @param title - Human-readable error title
 * @param detail - Optional detailed message (string) or validation errors object
 * @param errors - Optional validation errors object (alternative to detail)
 * @returns Response with Content-Type: application/problem+json
 *
 * @example
 * // Simple error
 * errorResponse(404, "Context not found");
 *
 * @example
 * // With detail message
 * errorResponse(400, "Invalid request", "Missing required field: name");
 *
 * @example
 * // With validation errors
 * errorResponse(400, "Validation failed", undefined, zodError.flatten());
 */
export function errorResponse(
  status: number,
  title: string,
  detail?: string,
  errors?: unknown,
): Response {
  const body: ProblemDetails = {
    type: `https://api.kata-context.dev/errors/${status}`,
    title,
    status,
    ...(detail ? { detail } : {}),
    ...(errors ? { errors } : {}),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}
