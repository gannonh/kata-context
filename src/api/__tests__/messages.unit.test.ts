import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryError } from "../../repositories/types.js";

// Use vi.hoisted to ensure mocks are available before module loading
const { mockAppend, mockFindByContext, mockGetByTokenBudget, mockFindByVersion } = vi.hoisted(
  () => ({
    mockAppend: vi.fn(),
    mockFindByContext: vi.fn(),
    mockGetByTokenBudget: vi.fn(),
    mockFindByVersion: vi.fn(),
  }),
);

// Mock the repository as a class constructor
vi.mock("../../../src/repositories/index.js", () => ({
  MessageRepository: class MockMessageRepository {
    append = mockAppend;
    findByContext = mockFindByContext;
    getByTokenBudget = mockGetByTokenBudget;
    findByVersion = mockFindByVersion;
  },
  RepositoryError: RepositoryError,
}));

vi.mock("../../../src/db/client.js", () => ({
  db: {},
}));

// Import handlers after mocks are set up
import { GET as GET_MESSAGES, POST } from "../../../api/v1/contexts/[id]/messages.js";
import { GET as GET_WINDOW } from "../../../api/v1/contexts/[id]/window.js";

describe("POST /api/v1/contexts/:id/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends messages with valid input", async () => {
    const mockMessages = [
      {
        id: "msg-1",
        contextId: "123e4567-e89b-12d3-a456-426614174000",
        role: "user",
        content: "Hello",
        tokenCount: 5,
        version: 1,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "msg-2",
        contextId: "123e4567-e89b-12d3-a456-426614174000",
        role: "assistant",
        content: "Hi there!",
        tokenCount: 10,
        version: 2,
        createdAt: new Date("2026-01-01"),
      },
    ];

    mockAppend.mockResolvedValue(mockMessages);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "Hello", tokenCount: 5 },
            { role: "assistant", content: "Hi there!", tokenCount: 10 },
          ],
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].version).toBe(1);
    expect(body.data[1].version).toBe(2);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Invalid JSON");
  });

  it("returns 400 for empty messages array", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
    expect(body.errors).toBeDefined();
  });

  it("returns 400 for invalid message role", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "invalid", content: "Hello" }],
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
  });

  it("returns 404 when context not found (RepositoryError)", async () => {
    mockAppend.mockRejectedValue(new RepositoryError("Context not found", "NOT_FOUND"));

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.title).toBe("Context not found");
  });

  it("returns 400 for invalid UUID format", async () => {
    const request = new Request("http://localhost/api/v1/contexts/not-a-uuid/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("UUID");
  });
});

describe("GET /api/v1/contexts/:id/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated messages", async () => {
    const mockResult = {
      data: [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          version: 1,
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi",
          version: 2,
        },
      ],
      nextCursor: null,
      hasMore: false,
    };

    mockFindByContext.mockResolvedValue(mockResult);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages",
    );

    const response = await GET_MESSAGES(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.hasMore).toBe(false);
  });

  it("respects limit parameter", async () => {
    const mockResult = {
      data: [{ id: "msg-1", role: "user", content: "Hello", version: 1 }],
      nextCursor: 1,
      hasMore: true,
    };

    mockFindByContext.mockResolvedValue(mockResult);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages?limit=1",
    );

    const response = await GET_MESSAGES(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe(1);
    expect(mockFindByContext).toHaveBeenCalledWith(
      "123e4567-e89b-12d3-a456-426614174000",
      expect.objectContaining({ limit: 1 }),
    );
  });

  it("returns 400 for invalid pagination params", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/messages?limit=-1",
    );

    const response = await GET_MESSAGES(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
  });

  it("returns 400 for invalid UUID format", async () => {
    const request = new Request("http://localhost/api/v1/contexts/invalid/messages");

    const response = await GET_MESSAGES(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("UUID");
  });
});

describe("GET /api/v1/contexts/:id/window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns messages within budget", async () => {
    const mockMessages = [
      { id: "msg-1", role: "user", content: "Hello", tokenCount: 10, version: 1 },
      { id: "msg-2", role: "assistant", content: "Hi", tokenCount: 10, version: 2 },
    ];

    mockGetByTokenBudget.mockResolvedValue(mockMessages);

    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/window?budget=100",
    );

    const response = await GET_WINDOW(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(mockGetByTokenBudget).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000", {
      budget: 100,
    });
  });

  it("returns 400 when budget missing", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/window",
    );

    const response = await GET_WINDOW(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
  });

  it("returns 400 when budget invalid (negative)", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/window?budget=-100",
    );

    const response = await GET_WINDOW(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
  });

  it("returns 400 when budget invalid (non-number)", async () => {
    const request = new Request(
      "http://localhost/api/v1/contexts/123e4567-e89b-12d3-a456-426614174000/window?budget=abc",
    );

    const response = await GET_WINDOW(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.title).toBe("Validation failed");
  });

  it("returns 400 for invalid UUID format", async () => {
    const request = new Request("http://localhost/api/v1/contexts/invalid/window?budget=100");

    const response = await GET_WINDOW(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("UUID");
  });
});
