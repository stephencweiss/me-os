#!/usr/bin/env node

import { validateDependencyConfiguration } from "../lib/time-analysis.js";

async function main() {
  try {
    await validateDependencyConfiguration();
    console.log("Dependency configuration is valid.");
  } catch (error: any) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

main();
