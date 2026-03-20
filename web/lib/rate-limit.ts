/**
 * Rate limiting for AI endpoints
 *
 * Uses user preferences table to track daily request counts.
 * Resets at midnight UTC.
 */

import { getPreference, setPreference } from "./db-supabase";

/**
 * Default daily limit for AI requests
 */
const DEFAULT_DAILY_LIMIT = 50;

/**
 * Get the rate limit key for today
 */
function getRateLimitKey(): string {
  const today = new Date().toISOString().split("T")[0];
  return `ai_requests_${today}`;
}

/**
 * Check if user has exceeded their daily AI request limit
 */
export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const key = getRateLimitKey();
  const countStr = await getPreference(userId, key);
  const count = countStr ? parseInt(countStr, 10) : 0;

  const limit = DEFAULT_DAILY_LIMIT;
  const remaining = Math.max(0, limit - count);
  const allowed = count < limit;

  return { allowed, remaining, limit };
}

/**
 * Increment the user's AI request count for today
 */
export async function incrementRateLimit(userId: string): Promise<void> {
  const key = getRateLimitKey();
  const countStr = await getPreference(userId, key);
  const count = countStr ? parseInt(countStr, 10) : 0;
  await setPreference(userId, key, String(count + 1));
}

/**
 * Rate limit response headers
 */
export function rateLimitHeaders(remaining: number, limit: number): HeadersInit {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  };
}
