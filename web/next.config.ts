import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const webDir = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (parent of `web/`). Pins Turbopack so the extra `web/pnpm-lock.yaml` does not confuse inference. */
const monorepoRoot = path.resolve(webDir, "..");

/** Same value as NEXT_PUBLIC_BASE_PATH (set in Vercel for subpath deploys). */
const basePathRaw =
  process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") ?? "";
const basePath =
  basePathRaw.startsWith("/") && basePathRaw.length > 1 ? basePathRaw : "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
