import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const webDir = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (parent of `web/`). Pins Turbopack so the extra `web/pnpm-lock.yaml` does not confuse inference. */
const monorepoRoot = path.resolve(webDir, "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
