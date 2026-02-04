import { describe, expect, it, vi } from "vitest";
import { extractContextId, isValidUUID, parseJsonBody, requireContextId } from "../helpers.js";

describe("extractContextId", () => {
  it("extracts UUID from contexts path", () => {
    expect(extractContextId("/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("extracts ID from nested path (messages)", () => {
    expect(extractContextId("/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("extracts ID from nested path (window)", () => {
    expect(
      extractContextId("/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages/window"),
    ).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("returns null when no ID segment", () => {
    expect(extractContextId("/api/v1/contexts/")).toBeNull();
    expect(extractContextId("/api/v1/contexts")).toBeNull();
  });

  it("returns null for unrelated paths", () => {
    expect(extractContextId("/api/v1/health")).toBeNull();
  });
});

describe("isValidUUID", () => {
  it("accepts valid v4 UUID", () => {
    expect(isValidUUID("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });

  it("accepts valid v1 UUID", () => {
    expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidUUID("123E4567-E89B-42D3-A456-426614174000")).toBe(true);
  });

  it("rejects invalid format", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });
});

describe("requireContextId", () => {
  it("returns ID string for valid UUID", () => {
    const req = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000",
    );
    const result = requireContextId(req);
    expect(result).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("returns 400 Response when ID is missing", async () => {
    const req = new Request("http://localhost/api/v1/other");
    const result = requireContextId(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    const body = await (result as Response).json();
    expect(body.title).toBe("Invalid request");
  });

  it("returns 400 Response for invalid UUID format", async () => {
    const req = new Request("http://localhost/api/v1/contexts/bad-id");
    const result = requireContextId(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    const body = await (result as Response).json();
    expect(body.title).toBe("Invalid UUID");
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    });
    const result = await parseJsonBody(req);
    expect(result).toEqual({ key: "value" });
  });

  it("returns null and logs warning for invalid JSON", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new Request("http://localhost", {
      method: "POST",
      body: "not json",
    });
    const result = await parseJsonBody(req);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
