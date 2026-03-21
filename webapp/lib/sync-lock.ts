/** In-process guard: one active calendar sync per Next.js user id. */

const active = new Set<string>();

export type SyncLockResult<T> = { ok: true; value: T } | { ok: false; busy: true };

export async function withCalendarSyncLock<T>(userId: string, fn: () => Promise<T>): Promise<SyncLockResult<T>> {
  if (active.has(userId)) {
    return { ok: false, busy: true };
  }
  active.add(userId);
  try {
    const value = await fn();
    return { ok: true, value };
  } finally {
    active.delete(userId);
  }
}
