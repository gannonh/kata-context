import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 10000, // Allow time for PGlite migration setup
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
