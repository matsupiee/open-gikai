import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["seeds/**/*.test.ts"],
    passWithNoTests: true,
  },
});
