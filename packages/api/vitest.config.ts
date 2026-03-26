import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 15_000,
    fileParallelism: false,
    // globalSetup: ["src/test-setup.ts"], // PostgreSQL (db-auth) が必要な場合のみ有効化
  },
});
