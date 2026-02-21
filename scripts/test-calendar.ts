// Quick test script to verify calendar API access
import { getAuthenticatedClient, getCalendarClient } from "../lib/google-auth.js";

async function main() {
  const account = process.argv[2] || "personal";
  console.log(`Testing calendar access for account: ${account}\n`);

  const auth = await getAuthenticatedClient(account);
  const calendar = getCalendarClient(auth);

  // Get today's events
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Fetching events for ${now.toLocaleDateString()}...\n`);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items || [];

  if (events.length === 0) {
    console.log("No events found for today.");
  } else {
    console.log(`Found ${events.length} event(s):\n`);
    events.forEach((event) => {
      const start = event.start?.dateTime || event.start?.date;
      const time = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "All day";
      console.log(`  ${time} - ${event.summary}`);
    });
  }
}

main().catch(console.error);
