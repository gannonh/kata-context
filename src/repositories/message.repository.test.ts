import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../vitest.setup.js";
import { contexts, messages } from "../db/schema/index.js";
import { ContextRepository } from "./context.repository.js";
import { MessageRepository } from "./message.repository.js";
import { RepositoryError } from "./types.js";

describe("MessageRepository", () => {
  let contextRepo: ContextRepository;
  let messageRepo: MessageRepository;

  beforeAll(async () => {
    await setupTestDb();
    contextRepo = new ContextRepository(testDb);
    messageRepo = new MessageRepository(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean in correct order (messages first due to FK)
    await testDb.delete(messages);
    await testDb.delete(contexts);
  });

  describe("append", () => {
    it("assigns sequential version numbers", async () => {
      const ctx = await contextRepo.create({ name: "Test" });

      const inserted = await messageRepo.append(ctx.id, [
        { role: "user", content: "Hello", tokenCount: 5 },
        { role: "assistant", content: "Hi there!", tokenCount: 10 },
      ]);

      expect(inserted).toHaveLength(2);
      expect(inserted[0]!.version).toBe(1);
      expect(inserted[1]!.version).toBe(2);
    });

    it("continues version sequence from existing messages", async () => {
      const ctx = await contextRepo.create({ name: "Test" });

      await messageRepo.append(ctx.id, [{ role: "user", content: "First", tokenCount: 5 }]);

      const second = await messageRepo.append(ctx.id, [
        { role: "assistant", content: "Second", tokenCount: 10 },
      ]);

      expect(second[0]!.version).toBe(2);
    });

    it("updates context counters atomically", async () => {
      const ctx = await contextRepo.create({ name: "Test" });

      await messageRepo.append(ctx.id, [
        { role: "user", content: "Hello", tokenCount: 5 },
        { role: "assistant", content: "Hi!", tokenCount: 10 },
      ]);

      const updated = await contextRepo.findById(ctx.id);
      expect(updated?.messageCount).toBe(2);
      expect(updated?.totalTokens).toBe(15);
      expect(updated?.latestVersion).toBe(2);
    });

    it("handles null tokenCount", async () => {
      const ctx = await contextRepo.create({ name: "Test" });

      const inserted = await messageRepo.append(ctx.id, [
        { role: "user", content: "No tokens" }, // tokenCount omitted
      ]);

      expect(inserted[0]!.tokenCount).toBeNull();

      const updated = await contextRepo.findById(ctx.id);
      expect(updated?.totalTokens).toBe(0); // null treated as 0
    });

    it("throws NOT_FOUND for non-existent context", async () => {
      await expect(
        messageRepo.append("00000000-0000-0000-0000-000000000000", [
          { role: "user", content: "Hello", tokenCount: 5 },
        ]),
      ).rejects.toThrow(RepositoryError);
    });

    it("throws NOT_FOUND for soft-deleted context", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await contextRepo.softDelete(ctx.id);

      await expect(
        messageRepo.append(ctx.id, [{ role: "user", content: "Hello", tokenCount: 5 }]),
      ).rejects.toThrow(RepositoryError);
    });

    it("returns empty array for empty input", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      const result = await messageRepo.append(ctx.id, []);
      expect(result).toEqual([]);
    });

    it("stores optional fields", async () => {
      const ctx = await contextRepo.create({ name: "Test" });

      const inserted = await messageRepo.append(ctx.id, [
        {
          role: "tool",
          content: '{"result": 42}',
          tokenCount: 8,
          toolCallId: "call_123",
          toolName: "calculator",
          model: "gpt-4",
        },
      ]);

      expect(inserted[0]!.toolCallId).toBe("call_123");
      expect(inserted[0]!.toolName).toBe("calculator");
      expect(inserted[0]!.model).toBe("gpt-4");
    });

    it("handles concurrent appends without version conflicts", async () => {
      const ctx = await contextRepo.create({ name: "Concurrent Test" });

      // Simulate two concurrent append operations
      const [batch1, batch2] = await Promise.all([
        messageRepo.append(ctx.id, [
          { role: "user", content: "Batch 1 - Msg 1", tokenCount: 5 },
          { role: "user", content: "Batch 1 - Msg 2", tokenCount: 5 },
        ]),
        messageRepo.append(ctx.id, [{ role: "user", content: "Batch 2 - Msg 1", tokenCount: 10 }]),
      ]);

      // Verify no duplicate versions
      const allVersions = [...batch1, ...batch2].map((m) => m.version);
      expect(new Set(allVersions).size).toBe(allVersions.length);

      // Verify sequential numbering (should be 1, 2, 3 in some order)
      expect(allVersions.sort((a, b) => a - b)).toEqual([1, 2, 3]);

      // Verify final context state
      const updated = await contextRepo.findById(ctx.id);
      expect(updated?.messageCount).toBe(3);
      expect(updated?.totalTokens).toBe(20);
      expect(updated?.latestVersion).toBe(3);
    });
  });

  describe("findByContext", () => {
    it("returns messages in ascending version order by default", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 5 },
        { role: "assistant", content: "Second", tokenCount: 10 },
        { role: "user", content: "Third", tokenCount: 5 },
      ]);

      const result = await messageRepo.findByContext(ctx.id);

      expect(result.data).toHaveLength(3);
      expect(result.data[0]!.content).toBe("First");
      expect(result.data[2]!.content).toBe("Third");
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("supports descending order", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 5 },
        { role: "assistant", content: "Second", tokenCount: 10 },
      ]);

      const result = await messageRepo.findByContext(ctx.id, { order: "desc" });

      expect(result.data[0]!.content).toBe("Second");
      expect(result.data[1]!.content).toBe("First");
    });

    it("supports descending order with cursor", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "M1", tokenCount: 5 },
        { role: "user", content: "M2", tokenCount: 5 },
        { role: "user", content: "M3", tokenCount: 5 },
      ]);

      const page1 = await messageRepo.findByContext(ctx.id, { limit: 1, order: "desc" });
      expect(page1.data[0]!.content).toBe("M3");
      expect(page1.hasMore).toBe(true);

      const page2 = await messageRepo.findByContext(ctx.id, {
        limit: 1,
        order: "desc",
        cursor: page1.nextCursor!,
      });
      expect(page2.data[0]!.content).toBe("M2");
    });

    it("paginates with cursor", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "M1", tokenCount: 5 },
        { role: "user", content: "M2", tokenCount: 5 },
        { role: "user", content: "M3", tokenCount: 5 },
        { role: "user", content: "M4", tokenCount: 5 },
        { role: "user", content: "M5", tokenCount: 5 },
      ]);

      // First page
      const page1 = await messageRepo.findByContext(ctx.id, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.data[0]!.content).toBe("M1");
      expect(page1.data[1]!.content).toBe("M2");
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(2);

      // Second page using cursor
      const page2 = await messageRepo.findByContext(ctx.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.data).toHaveLength(2);
      expect(page2.data[0]!.content).toBe("M3");
      expect(page2.data[1]!.content).toBe("M4");
      expect(page2.hasMore).toBe(true);

      // Third page (last)
      const page3 = await messageRepo.findByContext(ctx.id, {
        limit: 2,
        cursor: page2.nextCursor!,
      });
      expect(page3.data).toHaveLength(1);
      expect(page3.data[0]!.content).toBe("M5");
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeNull();
    });

    it("returns empty for non-existent context", async () => {
      const result = await messageRepo.findByContext("00000000-0000-0000-0000-000000000000");
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty for soft-deleted context", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test message", tokenCount: 5 }]);

      // Soft delete the context
      await contextRepo.softDelete(ctx.id);

      // Messages should not be accessible via soft-deleted context
      const result = await messageRepo.findByContext(ctx.id);
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("handles negative cursor gracefully", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "M1", tokenCount: 5 },
        { role: "user", content: "M2", tokenCount: 5 },
      ]);

      // Negative cursor should return all messages (no version is < 0)
      const result = await messageRepo.findByContext(ctx.id, { cursor: -1 });
      expect(result.data).toHaveLength(2);
    });

    it("caps limit at maximum allowed value", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "M1", tokenCount: 5 }]);

      // Request absurdly high limit - should be capped internally
      const result = await messageRepo.findByContext(ctx.id, { limit: 100000 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getByTokenBudget", () => {
    it("returns messages fitting within budget in chronological order", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 10 },
        { role: "assistant", content: "Second", tokenCount: 20 },
        { role: "user", content: "Third", tokenCount: 15 },
        { role: "assistant", content: "Fourth", tokenCount: 25 },
      ]);

      // Budget of 40 should include Third (15) + Fourth (25) = 40
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 40 });

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe("Third"); // Chronological order
      expect(result[1]!.content).toBe("Fourth");
    });

    it("returns all messages when budget exceeds total", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 10 },
        { role: "assistant", content: "Second", tokenCount: 20 },
      ]);

      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 1000 });

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe("First");
      expect(result[1]!.content).toBe("Second");
    });

    it("always includes at least one message", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "Large message", tokenCount: 100 },
      ]);

      // Budget smaller than single message
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe("Large message");
    });

    it("returns empty for empty context", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 100 });
      expect(result).toHaveLength(0);
    });

    it("returns empty for zero budget", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test", tokenCount: 10 }]);

      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 0 });
      expect(result).toHaveLength(0);
    });

    it("handles null tokenCount as zero", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "No count" }, // null tokenCount
        { role: "assistant", content: "Has count", tokenCount: 50 },
      ]);

      // Budget of 50 should include both (0 + 50 = 50)
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 50 });
      expect(result).toHaveLength(2);
    });

    it("returns empty for soft-deleted context", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test message", tokenCount: 10 }]);

      // Soft delete the context
      await contextRepo.softDelete(ctx.id);

      // Messages should not be accessible via soft-deleted context
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 100 });
      expect(result).toHaveLength(0);
    });

    it("includes message when budget exactly equals token count", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 25 },
        { role: "assistant", content: "Second", tokenCount: 25 },
      ]);

      // Budget of 25 should include only the last message (25 tokens)
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: 25 });
      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe("Second");
    });

    it("returns empty for NaN budget", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test", tokenCount: 10 }]);

      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: NaN });
      expect(result).toHaveLength(0);
    });

    it("returns empty for Infinity budget", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test", tokenCount: 10 }]);

      // Infinity is not finite, should return empty
      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: Infinity });
      expect(result).toHaveLength(0);
    });

    it("returns empty for negative budget", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [{ role: "user", content: "Test", tokenCount: 10 }]);

      const result = await messageRepo.getByTokenBudget(ctx.id, { budget: -100 });
      expect(result).toHaveLength(0);
    });
  });

  describe("findByVersion", () => {
    it("returns message at specific version", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      await messageRepo.append(ctx.id, [
        { role: "user", content: "First", tokenCount: 5 },
        { role: "assistant", content: "Second", tokenCount: 10 },
      ]);

      const msg = await messageRepo.findByVersion(ctx.id, 2);
      expect(msg?.content).toBe("Second");
    });

    it("returns null for non-existent version", async () => {
      const ctx = await contextRepo.create({ name: "Test" });
      const msg = await messageRepo.findByVersion(ctx.id, 999);
      expect(msg).toBeNull();
    });
  });
});
