import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../vitest.setup.js";
import { contexts } from "../db/schema/index.js";
import { resolvePolicy } from "../validation/policy.js";
import { ContextRepository } from "./context.repository.js";

describe("ContextRepository", () => {
  let repository: ContextRepository;

  beforeAll(async () => {
    await setupTestDb();
    repository = new ContextRepository(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await testDb.delete(contexts);
  });

  describe("create", () => {
    it("creates a context with auto-generated fields", async () => {
      const ctx = await repository.create({ name: "Test Context" });

      expect(ctx.id).toBeDefined();
      expect(ctx.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(ctx.name).toBe("Test Context");
      expect(ctx.messageCount).toBe(0);
      expect(ctx.totalTokens).toBe(0);
      expect(ctx.latestVersion).toBe(0);
      expect(ctx.createdAt).toBeInstanceOf(Date);
      expect(ctx.updatedAt).toBeInstanceOf(Date);
      expect(ctx.deletedAt).toBeNull();
    });

    it("creates a context without name", async () => {
      const ctx = await repository.create({});

      expect(ctx.id).toBeDefined();
      expect(ctx.name).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns context by ID", async () => {
      const created = await repository.create({ name: "Find Me" });
      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Find Me");
    });

    it("returns null for non-existent ID", async () => {
      const found = await repository.findById("00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });

    it("excludes soft-deleted contexts", async () => {
      const ctx = await repository.create({ name: "To Delete" });
      await repository.softDelete(ctx.id);

      const found = await repository.findById(ctx.id);
      expect(found).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt timestamp", async () => {
      const ctx = await repository.create({ name: "Delete Me" });
      const deleted = await repository.softDelete(ctx.id);

      expect(deleted).not.toBeNull();
      expect(deleted?.deletedAt).toBeInstanceOf(Date);
    });

    it("returns null for non-existent ID", async () => {
      const deleted = await repository.softDelete("00000000-0000-0000-0000-000000000000");
      expect(deleted).toBeNull();
    });

    it("returns null when already deleted", async () => {
      const ctx = await repository.create({ name: "Already Deleted" });
      await repository.softDelete(ctx.id);

      const secondDelete = await repository.softDelete(ctx.id);
      expect(secondDelete).toBeNull();
    });
  });

  describe("policyConfig", () => {
    it("persists policyConfig on create and returns it on findById", async () => {
      const ctx = await repository.create({
        name: "With Policy",
        policyConfig: { threshold: 0.6, preserveRecentCount: 5, enabled: false },
      });
      const found = await repository.findById(ctx.id);
      expect(found?.policyConfig).toEqual({
        threshold: 0.6,
        preserveRecentCount: 5,
        enabled: false,
      });
    });

    it("returns null policyConfig when created without one", async () => {
      const ctx = await repository.create({ name: "No Policy" });
      const found = await repository.findById(ctx.id);
      expect(found?.policyConfig).toBeNull();
    });

    it("stores resolved partial policy as full config", async () => {
      const policy = resolvePolicy({ threshold: 0.5 });
      const ctx = await repository.create({ name: "Partial", policyConfig: policy });
      const found = await repository.findById(ctx.id);
      expect(found?.policyConfig).toEqual({
        threshold: 0.5,
        preserveRecentCount: 10,
        enabled: true,
      });
    });
  });

  describe("exists", () => {
    it("returns true for existing context", async () => {
      const ctx = await repository.create({ name: "Exists" });
      expect(await repository.exists(ctx.id)).toBe(true);
    });

    it("returns false for non-existent context", async () => {
      expect(await repository.exists("00000000-0000-0000-0000-000000000000")).toBe(false);
    });

    it("returns false for soft-deleted context", async () => {
      const ctx = await repository.create({ name: "Was Here" });
      await repository.softDelete(ctx.id);
      expect(await repository.exists(ctx.id)).toBe(false);
    });
  });
});
