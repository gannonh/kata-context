import pg from "pg";
import { describe, expect, it } from "vitest";
import { handleDatabaseError } from "../helpers.js";
import { RepositoryError } from "../types.js";

const { DatabaseError } = pg;

function makePgError(code: string, message = "pg error", constraint?: string): Error {
  const dbErr = new DatabaseError(message, 0, "error");
  dbErr.code = code;
  if (constraint) dbErr.constraint = constraint;
  // Drizzle wraps DatabaseError as cause
  const wrapper = new Error("drizzle wrapper");
  (wrapper as { cause?: unknown }).cause = dbErr;
  return wrapper;
}

describe("handleDatabaseError", () => {
  it("throws DUPLICATE for unique_violation (23505)", () => {
    const err = makePgError("23505", "dup", "contexts_pkey");
    expect(() => handleDatabaseError(err)).toThrow(RepositoryError);
    try {
      handleDatabaseError(err);
    } catch (e) {
      expect((e as RepositoryError).code).toBe("DUPLICATE");
      expect((e as RepositoryError).constraint).toBe("contexts_pkey");
    }
  });

  it("throws FOREIGN_KEY for foreign_key_violation (23503)", () => {
    const err = makePgError("23503", "fk", "messages_context_id_fkey");
    expect(() => handleDatabaseError(err)).toThrow(RepositoryError);
    try {
      handleDatabaseError(err);
    } catch (e) {
      expect((e as RepositoryError).code).toBe("FOREIGN_KEY");
      expect((e as RepositoryError).constraint).toBe("messages_context_id_fkey");
    }
  });

  it("throws DATABASE_ERROR for unknown PG error code", () => {
    const err = makePgError("42P01", "relation does not exist");
    expect(() => handleDatabaseError(err)).toThrow(RepositoryError);
    try {
      handleDatabaseError(err);
    } catch (e) {
      expect((e as RepositoryError).code).toBe("DATABASE_ERROR");
    }
  });

  it("re-throws non-DatabaseError as-is", () => {
    const err = new Error("random failure");
    expect(() => handleDatabaseError(err)).toThrow("random failure");
  });

  it("handles unique_violation without constraint", () => {
    const err = makePgError("23505", "dup");
    try {
      handleDatabaseError(err);
    } catch (e) {
      expect((e as RepositoryError).constraint).toBeUndefined();
    }
  });

  it("handles foreign_key_violation without constraint", () => {
    const err = makePgError("23503", "fk");
    try {
      handleDatabaseError(err);
    } catch (e) {
      expect((e as RepositoryError).code).toBe("FOREIGN_KEY");
      expect((e as RepositoryError).constraint).toBeUndefined();
    }
  });
});
