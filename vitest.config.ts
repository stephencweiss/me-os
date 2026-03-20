import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Include both core tests and web package tests
    include: [
      "tests/**/*.test.ts",
      "web/__tests__/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**"],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./web/vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "web"),
      "server-only": path.resolve(__dirname, "web/vitest-server-only-stub.ts"),
    },
  },
});
