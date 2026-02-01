import { sql } from "drizzle-orm";
import { db } from "../src/db/client.js";

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "connected" | "disconnected";
      latencyMs?: number;
      pooled?: boolean;
      error?: string;
    };
  };
}

export async function GET(_request: Request): Promise<Response> {
  const startTime = performance.now();
  const response: HealthResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    checks: {
      database: {
        status: "disconnected",
      },
    },
  };

  try {
    // Simple query to verify connection
    await db.execute(sql`SELECT 1`);

    const latencyMs = Math.round(performance.now() - startTime);

    // Check if using pooled connection
    const connectionString = process.env.DATABASE_URL ?? "";
    const isPooled = connectionString.includes("-pooler");

    response.checks.database = {
      status: "connected",
      latencyMs,
      pooled: isPooled,
    };
  } catch (error) {
    // Log full error details for observability (server-side only)
    console.error("[health] Database check failed:", error);

    response.status = "unhealthy";
    response.checks.database = {
      status: "disconnected",
      // Return generic message to avoid leaking internal details
      error: "Database connection failed",
    };

    return Response.json(response, { status: 503 });
  }

  return Response.json(response);
}
