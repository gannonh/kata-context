import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../../vitest.setup.js";
import type * as schema from "../../db/schema/index.js";
import { contexts, messages } from "../../db/schema/index.js";
import { ContextRepository } from "../../repositories/context.repository.js";

// Use vi.hoisted to create a shared ref that's available during mock hoisting
const { dbRef } = vi.hoisted(() => ({
  dbRef: { current: null as PgliteDatabase<typeof schema> | null },
}));

// Mock the db import to use the hoisted ref
vi.mock("../../../src/db/client.js", () => ({
  get db() {
    return dbRef.current;
  },
}));

// These will be set after module reset
let POST: (request: Request) => Promise<Response>;
let GET_MESSAGES: (request: Request) => Promise<Response>;
let GET_WINDOW: (request: Request) => Promise<Response>;

describe("Messages API Integration", () => {
  let contextRepo: ContextRepository;
  let testContextId: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDb();
    // Set the dbRef so the mock returns the correct db
    dbRef.current = testDb;

    // Reset modules to re-import handlers with the correct db
    vi.resetModules();

    // Re-import handlers now that db is set
    const messagesModule = await import("../../../api/v1/contexts/[id]/messages.js");
    const windowModule = await import("../../../api/v1/contexts/[id]/window.js");

    POST = messagesModule.POST;
    GET_MESSAGES = messagesModule.GET;
    GET_WINDOW = windowModule.GET;

    // Create repository using testDb directly
    contextRepo = new ContextRepository(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
    dbRef.current = null;
  });

  beforeEach(async () => {
    // Clean tables in correct order (messages first due to FK)
    await testDb.delete(messages);
    await testDb.delete(contexts);

    // Create a fresh context for each test
    const ctx = await contextRepo.create({ name: "Test Context" });
    testContextId = ctx.id;
  });

  describe("POST /api/v1/contexts/:id/messages", () => {
    it("appends single message with version assigned", async () => {
      const request = new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello", tokenCount: 5 }],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const { data } = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].version).toBe(1);
      expect(data[0].role).toBe("user");
      expect(data[0].content).toBe("Hello");
      expect(data[0].tokenCount).toBe(5);
    });

    it("appends multiple messages with sequential versions", async () => {
      const request = new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "First", tokenCount: 5 },
            { role: "assistant", content: "Second", tokenCount: 10 },
            { role: "user", content: "Third", tokenCount: 5 },
          ],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const { data } = await response.json();
      expect(data).toHaveLength(3);
      expect(data[0].version).toBe(1);
      expect(data[1].version).toBe(2);
      expect(data[2].version).toBe(3);
    });

    it("returns 404 for non-existent context", async () => {
      const request = new Request(
        "http://localhost/api/v1/contexts/1ce29116-e432-4744-b367-2bde16b46397/messages",
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
    });
  });

  describe("GET /api/v1/contexts/:id/messages", () => {
    it("returns empty array for empty context (not 404)", async () => {
      const request = new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`);

      const response = await GET_MESSAGES(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(0);
      expect(body.hasMore).toBe(false);
    });

    it("returns messages in correct order", async () => {
      // Add messages first
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: "First", tokenCount: 5 },
              { role: "assistant", content: "Second", tokenCount: 10 },
            ],
          }),
        }),
      );

      // Fetch messages
      const response = await GET_MESSAGES(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].content).toBe("First");
      expect(body.data[1].content).toBe("Second");
    });

    it("supports cursor-based pagination", async () => {
      // Add 5 messages
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: "M1", tokenCount: 1 },
              { role: "assistant", content: "M2", tokenCount: 1 },
              { role: "user", content: "M3", tokenCount: 1 },
              { role: "assistant", content: "M4", tokenCount: 1 },
              { role: "user", content: "M5", tokenCount: 1 },
            ],
          }),
        }),
      );

      // Fetch first page (limit 2)
      const page1Res = await GET_MESSAGES(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages?limit=2`),
      );
      const page1 = await page1Res.json();

      expect(page1.data).toHaveLength(2);
      expect(page1.data[0].content).toBe("M1");
      expect(page1.data[1].content).toBe("M2");
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(2);

      // Fetch second page using cursor
      const page2Res = await GET_MESSAGES(
        new Request(
          `http://localhost/api/v1/contexts/${testContextId}/messages?limit=2&cursor=${page1.nextCursor}`,
        ),
      );
      const page2 = await page2Res.json();

      expect(page2.data).toHaveLength(2);
      expect(page2.data[0].content).toBe("M3");
      expect(page2.data[1].content).toBe("M4");
      expect(page2.hasMore).toBe(true);
    });
  });

  describe("GET /api/v1/contexts/:id/window (Token Budget)", () => {
    it("returns empty array for empty context (not 404)", async () => {
      const request = new Request(
        `http://localhost/api/v1/contexts/${testContextId}/window?budget=100`,
      );

      const response = await GET_WINDOW(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(0);
    });

    it("returns all messages when budget exceeds total tokens", async () => {
      // Add messages with known token counts
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: "First", tokenCount: 10 },
              { role: "assistant", content: "Second", tokenCount: 20 },
            ],
          }),
        }),
      );

      // Budget of 1000 far exceeds total (30)
      const response = await GET_WINDOW(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/window?budget=1000`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].content).toBe("First");
      expect(body.data[1].content).toBe("Second");
    });

    it("returns most recent messages fitting budget", async () => {
      // Add messages with known token counts
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: "First", tokenCount: 10 },
              { role: "assistant", content: "Second", tokenCount: 20 },
              { role: "user", content: "Third", tokenCount: 15 },
              { role: "assistant", content: "Fourth", tokenCount: 25 },
            ],
          }),
        }),
      );

      // Budget of 40 should include Third (15) + Fourth (25) = 40
      const response = await GET_WINDOW(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/window?budget=40`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].content).toBe("Third");
      expect(body.data[1].content).toBe("Fourth");
    });

    it("returns at least one message even when budget is smaller than first message (TEST-03)", async () => {
      // Add a large message
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Large message", tokenCount: 100 }],
          }),
        }),
      );

      // Budget smaller than the message - should still return at least one
      const response = await GET_WINDOW(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/window?budget=10`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toBe("Large message");
    });

    it("returns empty for non-existent context (not 404) (TEST-03)", async () => {
      const request = new Request(
        "http://localhost/api/v1/contexts/1ce29116-e432-4744-b367-2bde16b46397/window?budget=100",
      );

      const response = await GET_WINDOW(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(0);
    });

    it("handles messages with null tokenCount (treated as 0)", async () => {
      // Add messages - one without tokenCount
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: "No count" }, // null tokenCount
              { role: "assistant", content: "Has count", tokenCount: 50 },
            ],
          }),
        }),
      );

      // Budget of 50 should include both (0 + 50 = 50)
      const response = await GET_WINDOW(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/window?budget=50`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
    });
  });

  describe("Edge Cases", () => {
    it("maintains version continuity across multiple appends", async () => {
      // First append
      await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "First" }],
          }),
        }),
      );

      // Second append
      const secondRes = await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "assistant", content: "Second" }],
          }),
        }),
      );

      const { data: secondData } = await secondRes.json();
      expect(secondData[0].version).toBe(2);

      // Third append
      const thirdRes = await POST(
        new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Third" }],
          }),
        }),
      );

      const { data: thirdData } = await thirdRes.json();
      expect(thirdData[0].version).toBe(3);
    });

    it("stores and retrieves tool messages correctly", async () => {
      const request = new Request(`http://localhost/api/v1/contexts/${testContextId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "tool",
              content: '{"result": 42}',
              tokenCount: 8,
              toolCallId: "call_123",
              toolName: "calculator",
            },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const { data } = await response.json();
      expect(data[0].role).toBe("tool");
      expect(data[0].toolCallId).toBe("call_123");
      expect(data[0].toolName).toBe("calculator");
    });
  });
});
