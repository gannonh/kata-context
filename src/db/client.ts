import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

// Handle ESM/CJS interop for pg module
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Verify pooled connection string (must contain -pooler)
// In production/Vercel, fail fast on misconfiguration to prevent connection exhaustion
if (!connectionString.includes("-pooler")) {
  const warningMessage =
    "DATABASE_URL does not contain -pooler. Non-pooled connections may exhaust under serverless load.";

  if (process.env.VERCEL) {
    throw new Error(`CRITICAL: ${warningMessage}`);
  }

  console.warn(`WARNING: ${warningMessage}`);
}

// Conservative pool settings for serverless
// Per research: keep pool small (2-3) to avoid exhaustion under Vercel Fluid scaling
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
});

// Handle pool-level errors (connection drops, network issues)
// Without this handler, errors become unhandled promise rejections
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", {
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

// Vercel Fluid lifecycle management - ensures connections close before function suspension
// Only attach in Vercel environment (not local dev)
if (process.env.VERCEL) {
  attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });
export { pool };
