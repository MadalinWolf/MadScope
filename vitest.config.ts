import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
    ],
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
