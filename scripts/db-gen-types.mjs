#!/usr/bin/env node
/**
 * Regenerate webapp/lib/database.types.ts from the linked Supabase project.
 *
 * Uses `npx supabase` (pinned major) so the CLI works without relying on
 * postinstall scripts (pnpm may ignore those for the supabase npm package).
 */

import { spawnSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

for (const p of [
  join(projectRoot, "webapp", ".env.local"),
  join(projectRoot, ".env.local"),
]) {
  if (existsSync(p)) config({ path: p });
}

const ref =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.SUPABASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").replace(".supabase.co", "");

if (!ref) {
  console.error("Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL in webapp/.env.local");
  process.exit(1);
}

const outFile = join(projectRoot, "webapp", "lib", "database.types.ts");
const args = [
  "-y",
  "supabase@2.83.0",
  "gen",
  "types",
  "typescript",
  "--project-id",
  ref,
  "--schema",
  "public",
  "--schema",
  "next_auth",
];

const result = spawnSync("npx", args, {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
  cwd: projectRoot,
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "supabase gen types failed");
  process.exit(result.status ?? 1);
}

writeFileSync(outFile, result.stdout, "utf8");
console.log(`Wrote ${outFile}`);
