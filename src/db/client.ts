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
if (!connectionString.includes("-pooler")) {
  console.warn(
    "WARNING: DATABASE_URL does not contain -pooler. Use pooled connection string for serverless.",
  );
}

// Conservative pool settings for serverless
// Per research: keep pool small (2-3) to avoid exhaustion under Vercel Fluid scaling
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
});

// Vercel Fluid lifecycle management - ensures connections close before function suspension
// Only attach in Vercel environment (not local dev)
if (process.env.VERCEL) {
  attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });
export { pool };
