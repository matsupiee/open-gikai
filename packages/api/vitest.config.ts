import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
    fileParallelism: false,
    globalSetup: ["src/test-setup.ts"],
  },
});
