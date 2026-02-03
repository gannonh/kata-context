/**
 * Creates a JSON success response
 *
 * @param status - HTTP status code (e.g., 200, 201)
 * @param data - Response data to serialize as JSON
 * @returns Response with JSON body
 *
 * @example
 * // Return created resource
 * successResponse(201, { data: context });
 *
 * @example
 * // Return list of items
 * successResponse(200, { data: contexts, nextCursor: 10 });
 */
export function successResponse<T>(status: number, data: T): Response {
  return Response.json(data, { status });
}
