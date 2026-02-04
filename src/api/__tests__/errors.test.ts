import { describe, expect, it } from "vitest";
import { errorResponse } from "../errors.js";

describe("errorResponse", () => {
  it("returns correct status and title", async () => {
    const res = errorResponse(404, "Not found");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.title).toBe("Not found");
    expect(body.status).toBe(404);
  });

  it("includes detail when provided", async () => {
    const res = errorResponse(400, "Bad request", "Missing field");
    const body = await res.json();
    expect(body.detail).toBe("Missing field");
  });

  it("includes errors when provided", async () => {
    const errors = { fieldErrors: { name: ["required"] } };
    const res = errorResponse(400, "Validation failed", undefined, errors);
    const body = await res.json();
    expect(body.errors).toEqual(errors);
    expect(body.detail).toBeUndefined();
  });

  it("includes both detail and errors", async () => {
    const errors = { fieldErrors: {} };
    const res = errorResponse(400, "Validation failed", "Check fields", errors);
    const body = await res.json();
    expect(body.detail).toBe("Check fields");
    expect(body.errors).toEqual(errors);
  });

  it("sets content-type to application/problem+json", () => {
    const res = errorResponse(500, "Error");
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });

  it("formats type URL with status code", async () => {
    const res = errorResponse(422, "Unprocessable");
    const body = await res.json();
    expect(body.type).toBe("https://api.kata-context.dev/errors/422");
  });
});
