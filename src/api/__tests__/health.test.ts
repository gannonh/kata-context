import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
  db: { execute: mockExecute },
}));

import { GET } from "../../../api/health.js";

describe("GET /health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy when DB succeeds", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("connected");
    expect(typeof body.checks.database.latencyMs).toBe("number");
  });

  it("returns 503 when DB throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExecute.mockRejectedValue(new Error("connection refused"));

    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("disconnected");
    expect(body.checks.database.error).toBe("Database connection failed");

    consoleSpy.mockRestore();
  });

  it("detects pooled connection from DATABASE_URL", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://host-pooler.neon.tech/db";
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(new Request("http://localhost/api/health"));
    const body = await res.json();
    expect(body.checks.database.pooled).toBe(true);

    process.env.DATABASE_URL = original;
  });

  it("uses npm_package_version when set", async () => {
    const original = process.env.npm_package_version;
    process.env.npm_package_version = "2.0.0";
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(new Request("http://localhost/api/health"));
    const body = await res.json();
    expect(body.version).toBe("2.0.0");

    process.env.npm_package_version = original;
  });

  it("falls back to 0.1.0 when npm_package_version unset", async () => {
    const original = process.env.npm_package_version;
    delete process.env.npm_package_version;
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(new Request("http://localhost/api/health"));
    const body = await res.json();
    expect(body.version).toBe("0.1.0");

    if (original !== undefined) process.env.npm_package_version = original;
  });

  it("detects non-pooled connection", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://host.neon.tech/db";
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(new Request("http://localhost/api/health"));
    const body = await res.json();
    expect(body.checks.database.pooled).toBe(false);

    process.env.DATABASE_URL = original;
  });
});
