import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, resolvePolicy } from "./policy.js";

describe("DEFAULT_POLICY", () => {
  it("equals the expected default values", () => {
    expect(DEFAULT_POLICY).toEqual({
      threshold: 0.8,
      preserveRecentCount: 10,
      enabled: true,
    });
  });
});

describe("resolvePolicy", () => {
  it("returns full defaults for empty object", () => {
    expect(resolvePolicy({})).toEqual({
      threshold: 0.8,
      preserveRecentCount: 10,
      enabled: true,
    });
  });

  it("merges partial config with defaults", () => {
    expect(resolvePolicy({ threshold: 0.5 })).toEqual({
      threshold: 0.5,
      preserveRecentCount: 10,
      enabled: true,
    });
  });

  it("returns full defaults for null input", () => {
    expect(resolvePolicy(null)).toEqual({
      threshold: 0.8,
      preserveRecentCount: 10,
      enabled: true,
    });
  });

  it("returns full defaults for undefined input", () => {
    expect(resolvePolicy(undefined)).toEqual({
      threshold: 0.8,
      preserveRecentCount: 10,
      enabled: true,
    });
  });

  it("throws for threshold above 1", () => {
    expect(() => resolvePolicy({ threshold: 1.1 })).toThrow();
  });

  it("throws for threshold below 0", () => {
    expect(() => resolvePolicy({ threshold: -0.1 })).toThrow();
  });

  it("throws for negative preserveRecentCount", () => {
    expect(() => resolvePolicy({ preserveRecentCount: -1 })).toThrow();
  });

  it("throws for non-integer preserveRecentCount", () => {
    expect(() => resolvePolicy({ preserveRecentCount: 1.5 })).toThrow();
  });
});
