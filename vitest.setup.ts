import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./src/db/schema/index.js";

let testClient: PGlite | null = null;
export let testDb: PgliteDatabase<typeof schema>;

export async function setupTestDb(): Promise<PgliteDatabase<typeof schema>> {
  // Create PGlite with vector extension for pgvector support
  testClient = new PGlite({
    extensions: { vector },
  });

  // Enable vector extension before running migrations
  await testClient.exec("CREATE EXTENSION IF NOT EXISTS vector;");

  testDb = drizzle(testClient, { schema });

  // Run migrations from src/db/migrations folder
  await migrate(testDb, { migrationsFolder: "./src/db/migrations" });

  return testDb;
}

export async function teardownTestDb(): Promise<void> {
  if (testClient) {
    await testClient.close();
    testClient = null;
  }
}
