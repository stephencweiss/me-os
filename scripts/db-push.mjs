#!/usr/bin/env node
/**
 * Push Supabase migrations via Management API (HTTPS).
 *
 * Adapted from animus-training/training-app. Uses the same flow so IPv4 HTTPS
 * works without a direct DB connection from the laptop.
 *
 * Usage:
 *   pnpm db:push              # Apply pending migrations
 *   pnpm db:push -- --dry-run # Preview only
 *   pnpm db:push -- --status  # Show applied vs pending
 *   pnpm db:push:prod         # NODE_ENV=production → web/.env.production
 *
 * Env (in web/.env.local first, then repo-root .env.local):
 *   SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL (project ref inferred from URL)
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function resolveEnvPath() {
  const isProd = process.env.NODE_ENV === "production";
  const name = isProd ? ".env.production" : ".env.local";
  const candidates = [
    join(projectRoot, "web", name),
    join(projectRoot, name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return { path: p, name, label: p.replace(projectRoot + "/", "") };
  }
  return null;
}

const resolved = resolveEnvPath();
if (!resolved) {
  const isProd = process.env.NODE_ENV === "production";
  console.error("Error: no env file found.");
  console.error(
    isProd
      ? "Create web/.env.production or .env.production with Supabase credentials."
      : "Create web/.env.local or .env.local (copy from web/.env.local.example)."
  );
  process.exit(1);
}

config({ path: resolved.path });
console.log(`Environment: ${process.env.NODE_ENV === "production" ? "PRODUCTION" : "development"} (${resolved.label})`);

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error(`Error: SUPABASE_ACCESS_TOKEN not found in ${resolved.label}`);
  console.error("Create a token: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.SUPABASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").replace(".supabase.co", "");

if (!PROJECT_REF) {
  console.error(`Error: No Supabase project ref in ${resolved.label}`);
  console.error("Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const showStatus = args.includes("--status");

async function executeSQL(sql) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return response.json();
}

async function ensureMigrationsTable() {
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `);
}

async function getAppliedMigrations() {
  try {
    const result = await executeSQL(`
      SELECT version FROM supabase_migrations.schema_migrations ORDER BY version
    `);
    return new Set(result.map((r) => r.version));
  } catch (error) {
    if (error.message.includes("does not exist")) {
      return new Set();
    }
    throw error;
  }
}

function getLocalMigrations() {
  const migrationsDir = join(projectRoot, "supabase", "migrations");
  if (!existsSync(migrationsDir)) {
    console.error(`Error: ${migrationsDir} does not exist`);
    process.exit(1);
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((filename) => {
    const version = filename.split("_")[0];
    const filepath = join(migrationsDir, filename);
    const sql = readFileSync(filepath, "utf-8");
    return { version, filename, filepath, sql };
  });
}

function sqlQuote(str) {
  return str.replace(/'/g, "''");
}

async function applyMigration(migration) {
  const { version, filename, sql } = migration;
  console.log(`  Applying: ${filename}`);
  await executeSQL(sql);
  await executeSQL(`
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('${sqlQuote(version)}', '${sqlQuote(filename)}')
    ON CONFLICT (version) DO NOTHING
  `);
  console.log(`  ✓ Applied: ${filename}`);
}

async function main() {
  console.log(`\nMeOS Supabase migrations (project: ${PROJECT_REF})`);
  console.log("─".repeat(50));

  try {
    console.log("  Checking migrations table...");
    await ensureMigrationsTable();
  } catch (error) {
    const msg = error.message || "";
    console.log("  Schema check failed, attempting to create...");
    if (msg.includes("supabase_migrations") && msg.includes("does not exist")) {
      console.log("  Creating supabase_migrations schema...");
      try {
        await executeSQL("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
        await ensureMigrationsTable();
        console.log("  Table ready.");
      } catch (createError) {
        console.error("  Failed:", createError.message);
        throw createError;
      }
    } else {
      console.error("  Unexpected error:", msg);
      throw error;
    }
  }

  const applied = await getAppliedMigrations();
  const local = getLocalMigrations();
  const pending = local.filter((m) => !applied.has(m.version));

  if (showStatus) {
    console.log(`\nMigration status:`);
    console.log(`  Local files: ${local.length}`);
    console.log(`  Applied:     ${applied.size}`);
    console.log(`  Pending:     ${pending.length}`);
    if (pending.length > 0) {
      console.log(`\nPending:`);
      pending.forEach((m) => console.log(`  - ${m.filename}`));
    }
    return;
  }

  if (pending.length === 0) {
    console.log("\n✓ All migrations are up to date");
    return;
  }

  console.log(`\nPending migrations: ${pending.length}`);
  pending.forEach((m) => console.log(`  - ${m.filename}`));

  if (isDryRun) {
    console.log("\n[Dry run] No changes applied");
    return;
  }

  console.log("\nApplying migrations...\n");
  for (const migration of pending) {
    try {
      await applyMigration(migration);
    } catch (error) {
      console.error(`\n✗ Failed: ${migration.filename}`);
      console.error(`  ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`\n✓ Applied ${pending.length} migration(s)`);
}

main().catch((error) => {
  console.error("\nFatal:", error.message);
  process.exit(1);
});
