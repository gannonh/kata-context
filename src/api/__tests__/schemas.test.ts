import { describe, expect, it } from "vitest";
import {
  appendMessagesSchema,
  paginationSchema,
  tokenBudgetSchema,
} from "../validation/schemas.js";

describe("appendMessagesSchema", () => {
  it("accepts valid user message", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid assistant message", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "assistant", content: "hi" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid system message", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "system", content: "you are helpful" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects tool role without toolCallId", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "tool", content: "result" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts tool role with toolCallId", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "tool", content: "result", toolCallId: "call_123" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = appendMessagesSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("uses defaults when no values provided", () => {
    const result = paginationSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.order).toBe("asc");
  });

  it("coerces string values to numbers", () => {
    const result = paginationSchema.parse({ cursor: "5", limit: "10" });
    expect(result.cursor).toBe(5);
    expect(result.limit).toBe(10);
  });

  it("rejects limit out of range", () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: 1001 }).success).toBe(false);
  });
});

describe("tokenBudgetSchema", () => {
  it("accepts valid budget", () => {
    const result = tokenBudgetSchema.parse({ budget: 1000 });
    expect(result.budget).toBe(1000);
  });

  it("rejects zero budget", () => {
    expect(tokenBudgetSchema.safeParse({ budget: 0 }).success).toBe(false);
  });

  it("rejects negative budget", () => {
    expect(tokenBudgetSchema.safeParse({ budget: -5 }).success).toBe(false);
  });

  it("coerces string to number", () => {
    const result = tokenBudgetSchema.parse({ budget: "500" });
    expect(result.budget).toBe(500);
  });
});
