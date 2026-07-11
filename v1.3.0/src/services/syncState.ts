/**
 * Incremental sync state tracking (P2.1).
 * Stores the last successful sync timestamp per data type in localStorage.
 * On subsequent loads, only records updated after this timestamp are fetched.
 */

const SYNC_KEY_PREFIX = 'cleannotes_lastSync_'

/** Get the last sync timestamp for a data type, or null if never synced */
export function getLastSyncAt(dataType: string): string | null {
  try {
    return localStorage.getItem(SYNC_KEY_PREFIX + dataType)
  } catch {
    return null
  }
}

/** Record the sync timestamp after a successful load */
export function setLastSyncAt(dataType: string, timestamp: string): void {
  try {
    localStorage.setItem(SYNC_KEY_PREFIX + dataType, timestamp)
  } catch {
    // localStorage may be full or blocked — silently ignore
  }
}

/** Clear sync state for a specific data type (forces full sync next time) */
export function clearLastSyncAt(dataType: string): void {
  try {
    localStorage.removeItem(SYNC_KEY_PREFIX + dataType)
  } catch {
    // ignore
  }
}

/** Clear all sync state — used on logout to force full sync on next login */
export function clearAllLastSyncAt(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(SYNC_KEY_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
