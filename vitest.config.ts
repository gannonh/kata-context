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
      include: ["src/**/*.ts", "api/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/db/migrations/**",
        "src/db/schema/**",
        "src/db/client.ts",
        "src/index.ts",
        "src/repositories/index.ts",
        "src/api/index.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
