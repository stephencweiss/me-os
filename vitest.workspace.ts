import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Root project tests (lib, scripts, etc.)
  {
    test: {
      name: "core",
      include: ["tests/**/*.test.ts"],
      exclude: ["**/node_modules/**"],
    },
  },
  // Web package tests with React and path aliases
  "web/vitest.config.ts",
]);
