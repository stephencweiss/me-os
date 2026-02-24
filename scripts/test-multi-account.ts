#!/usr/bin/env node
import { listAuthenticatedAccounts, getAllAuthenticatedClients } from "../lib/google-auth.js";

async function main() {
  console.log("Checking authenticated accounts...\n");

  const accounts = listAuthenticatedAccounts();
  console.log("Token files found for accounts:", accounts);

  console.log("\nLoading clients for all accounts...\n");
  const clients = await getAllAuthenticatedClients();

  console.log("Successfully loaded clients:", clients.map(c => c.account));

  if (clients.length < 2) {
    console.log("\nWARNING: Expected at least 2 accounts (personal and work)");
    return;
  }

  // Test fetching events from each account
  console.log("\nFetching sample events from each account...\n");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const { account, calendar } of clients) {
    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: weekAgo.toISOString(),
        timeMax: now.toISOString(),
        maxResults: 3,
        singleEvents: true,
        orderBy: "startTime",
      });

      const count = response.data.items?.length || 0;
      console.log(`[${account}] Found ${count} recent events`);
      if (count > 0) {
        console.log(`  Sample: "${response.data.items![0].summary}"`);
      }
    } catch (err: any) {
      console.error(`[${account}] Error: ${err.message}`);
    }
  }

  console.log("\nMulti-account test complete!");
}

main().catch(console.error);
