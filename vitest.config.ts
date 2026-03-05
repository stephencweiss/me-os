import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Include both core tests and webapp tests
    include: [
      "tests/**/*.test.ts",
      "webapp/__tests__/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**"],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./webapp/vitest.setup.ts"],
  },
  resolve: {
    alias: {
      // Webapp path aliases
      "@": path.resolve(__dirname, "webapp"),
    },
  },
});
