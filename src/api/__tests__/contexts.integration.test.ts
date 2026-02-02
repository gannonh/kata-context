import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../../vitest.setup.js";
import type * as schema from "../../db/schema/index.js";
import { contexts } from "../../db/schema/index.js";

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
let GET: (request: Request) => Promise<Response>;
let DELETE: (request: Request) => Promise<Response>;

describe("Contexts API Integration", () => {
  beforeAll(async () => {
    // Setup test database
    await setupTestDb();
    // Set the dbRef so the mock returns the correct db
    dbRef.current = testDb;

    // Reset modules to re-import handlers with the correct db
    vi.resetModules();

    // Re-import handlers now that db is set
    const contextsModule = await import("../../../api/v1/contexts/index.js");
    const contextIdModule = await import("../../../api/v1/contexts/[id]/index.js");

    POST = contextsModule.POST;
    GET = contextIdModule.GET;
    DELETE = contextIdModule.DELETE;
  });

  afterAll(async () => {
    await teardownTestDb();
    dbRef.current = null;
  });

  beforeEach(async () => {
    // Clean tables between tests
    await testDb.delete(contexts);
  });

  describe("POST /api/v1/contexts", () => {
    it("creates context and stores in database", async () => {
      const request = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Integration Test Context" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const { data: created } = await response.json();
      expect(created.id).toBeDefined();
      expect(created.name).toBe("Integration Test Context");
      expect(created.messageCount).toBe(0);
      expect(created.totalTokens).toBe(0);

      // Verify in database
      const [dbContext] = await testDb.select().from(contexts);
      expect(dbContext?.id).toBe(created.id);
      expect(dbContext?.name).toBe("Integration Test Context");
    });

    it("creates context without name", async () => {
      const request = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const { data: created } = await response.json();
      expect(created.name).toBeNull();
    });
  });

  describe("GET /api/v1/contexts/:id", () => {
    it("retrieves created context", async () => {
      // Create first
      const createRequest = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Get Test" }),
      });
      const createResponse = await POST(createRequest);
      const { data: created } = await createResponse.json();

      // Then retrieve
      const getRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
      const getResponse = await GET(getRequest);

      expect(getResponse.status).toBe(200);
      const { data: fetched } = await getResponse.json();
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe("Get Test");
    });

    it("returns 404 for non-existent context", async () => {
      // Use a valid UUID v4 format that doesn't exist in the database
      const request = new Request(
        "http://localhost/api/v1/contexts/1ce29116-e432-4744-b367-2bde16b46397",
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/contexts/:id", () => {
    it("soft-deletes context and returns deleted data", async () => {
      // Create first
      const createRequest = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Delete Test" }),
      });
      const createResponse = await POST(createRequest);
      const { data: created } = await createResponse.json();

      // Delete
      const deleteRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`, {
        method: "DELETE",
      });
      const deleteResponse = await DELETE(deleteRequest);

      expect(deleteResponse.status).toBe(200);
      const { data: deleted } = await deleteResponse.json();
      expect(deleted.id).toBe(created.id);
      expect(deleted.deletedAt).not.toBeNull();

      // Verify subsequent GET returns 404
      const verifyRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
      const verifyResponse = await GET(verifyRequest);

      expect(verifyResponse.status).toBe(404);
    });
  });

  describe("Full CRUD lifecycle", () => {
    it("creates, reads, and deletes context", async () => {
      // Create
      const createRequest = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Full Lifecycle" }),
      });
      const createResponse = await POST(createRequest);
      expect(createResponse.status).toBe(201);

      const { data: created } = await createResponse.json();
      expect(created.id).toBeDefined();

      // Read
      const getRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
      const getResponse = await GET(getRequest);
      expect(getResponse.status).toBe(200);

      const { data: fetched } = await getResponse.json();
      expect(fetched.name).toBe("Full Lifecycle");

      // Delete
      const deleteRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`, {
        method: "DELETE",
      });
      const deleteResponse = await DELETE(deleteRequest);
      expect(deleteResponse.status).toBe(200);

      const { data: deleted } = await deleteResponse.json();
      expect(deleted.deletedAt).toBeDefined();

      // Verify deleted
      const verifyRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
      const verifyResponse = await GET(verifyRequest);
      expect(verifyResponse.status).toBe(404);
    });

    it("creates multiple contexts independently", async () => {
      // Create first context
      const req1 = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Context 1" }),
      });
      const res1 = await POST(req1);
      const { data: ctx1 } = await res1.json();

      // Create second context
      const req2 = new Request("http://localhost/api/v1/contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Context 2" }),
      });
      const res2 = await POST(req2);
      const { data: ctx2 } = await res2.json();

      // Verify both exist independently
      expect(ctx1.id).not.toBe(ctx2.id);

      const get1 = await GET(new Request(`http://localhost/api/v1/contexts/${ctx1.id}`));
      const get2 = await GET(new Request(`http://localhost/api/v1/contexts/${ctx2.id}`));

      expect(get1.status).toBe(200);
      expect(get2.status).toBe(200);

      const { data: fetched1 } = await get1.json();
      const { data: fetched2 } = await get2.json();

      expect(fetched1.name).toBe("Context 1");
      expect(fetched2.name).toBe("Context 2");
    });
  });
});
