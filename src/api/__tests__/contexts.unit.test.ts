import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure mocks are available before module loading
const { mockCreate, mockFindById, mockSoftDelete, mockExists } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockSoftDelete: vi.fn(),
  mockExists: vi.fn(),
}));

// Mock the repository as a class constructor
vi.mock("../../../src/repositories/index.js", () => ({
  ContextRepository: class MockContextRepository {
    create = mockCreate;
    findById = mockFindById;
    softDelete = mockSoftDelete;
    exists = mockExists;
  },
}));

vi.mock("../../../src/db/client.js", () => ({
  db: {},
}));

import { DELETE, GET } from "../../../api/v1/contexts/[id]/index.js";
// Import handlers after mocks are set up
import { POST } from "../../../api/v1/contexts/index.js";

describe("POST /api/v1/contexts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates context with valid name", async () => {
    const mockContext = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Test Context",
      messageCount: 0,
      totalTokens: 0,
      latestVersion: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
    };

    mockCreate.mockResolvedValue(mockContext);

    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Context" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.name).toBe("Test Context");
    expect(body.data.id).toBe(mockContext.id);
    expect(mockCreate).toHaveBeenCalledWith({ name: "Test Context" });
  });

  it("creates context with empty body (optional name)", async () => {
    const mockContext = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: null,
      messageCount: 0,
      totalTokens: 0,
      latestVersion: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
    };

    mockCreate.mockResolvedValue(mockContext);

    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.name).toBeNull();
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Invalid JSON");
    expect(body.type).toContain("400");
  });

  it("returns 400 for validation errors (name too long)", async () => {
    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a".repeat(300) }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
    expect(body.errors).toBeDefined();
  });

  it("returns 500 and logs on repository error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("Database connection failed"));

    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.title).toBe("Internal server error");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("GET /api/v1/contexts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context when found", async () => {
    const mockContext = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Found Context",
      messageCount: 5,
      totalTokens: 100,
      latestVersion: 5,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
    };

    mockFindById.mockResolvedValue(mockContext);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(mockContext.id);
    expect(body.data.name).toBe("Found Context");
  });

  it("returns 404 when not found", async () => {
    mockFindById.mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000",
    );

    const response = await GET(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.title).toBe("Context not found");
  });

  it("returns 400 for invalid UUID format", async () => {
    const request = new Request("http://localhost/api/v1/contexts/not-a-uuid");

    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Invalid UUID");
  });
});

describe("DELETE /api/v1/contexts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-deletes and returns context", async () => {
    const mockContext = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Deleted Context",
      messageCount: 0,
      totalTokens: 0,
      latestVersion: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: new Date("2026-01-02"),
    };

    mockSoftDelete.mockResolvedValue(mockContext);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000",
      { method: "DELETE" },
    );

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(mockContext.id);
    expect(body.data.deletedAt).toBeDefined();
  });

  it("returns 404 when not found", async () => {
    mockSoftDelete.mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000",
      { method: "DELETE" },
    );

    const response = await DELETE(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.title).toBe("Context not found");
  });

  it("returns 400 for invalid UUID format", async () => {
    const request = new Request("http://localhost/api/v1/contexts/invalid-uuid", {
      method: "DELETE",
    });

    const response = await DELETE(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Invalid UUID");
  });
});
