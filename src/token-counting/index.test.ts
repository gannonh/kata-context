import { describe, expect, it } from "vitest";
import { countMessageTokens } from "./index.js";

describe("countMessageTokens", () => {
  it("returns a positive integer for non-empty strings", () => {
    const count = countMessageTokens("hello world");
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it("returns 0 for empty string", () => {
    expect(countMessageTokens("")).toBe(0);
  });

  it("returns consistent results for the same input", () => {
    const input = "The quick brown fox jumps over the lazy dog";
    const first = countMessageTokens(input);
    const second = countMessageTokens(input);
    expect(first).toBe(second);
  });

  it("returns a stable count for a known string", () => {
    // "hello world" tokenizes to 2 tokens with o200k_base
    const count = countMessageTokens("hello world");
    expect(count).toBe(2);
  });
});
