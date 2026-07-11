/**
 * Sync state tracking — clear functions only.
 * (P-16: getLastSyncAt/setLastSyncAt removed — incremental sync was deprecated
 *  in favor of pure-online architecture; only clear* functions remain in use.)
 */

const SYNC_KEY_PREFIX = 'cleannotes_lastSync_'

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
