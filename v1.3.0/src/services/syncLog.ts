/**
 * syncLog — 同步日志服务
 *
 * 将每次同步操作记录到 localStorage，最多保留 3 条，FIFO 淘汰。
 * 供 SyncLogModal 弹窗展示。
 */

const STORAGE_KEY_PREFIX = 'cleannotes_sync_logs_'
const MAX_ENTRIES = 3

export interface SyncLogEntry {
  id: string
  timestamp: string // UTC ISO
  type: 'full_merge' | 'incremental' | 'dirty_replay' | 'error'
  summary: string
  tasksSynced: number
  deletedSynced: number
  memosSynced: number
  todosSynced: number
  reportsSynced: number
  status: 'success' | 'partial' | 'failed'
  errorMsg?: string
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

let currentUserId = ''
export function setSyncLogUserId(uid: string) { currentUserId = uid }

export function getSyncLogs(): SyncLogEntry[] {
  if (!currentUserId) return []
  try {
    const raw = localStorage.getItem(getStorageKey(currentUserId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** 追加一条日志，保持最多 MAX_ENTRIES 条 */
export function appendSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): void {
  if (!currentUserId) return

  const log: SyncLogEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  }

  const logs = getSyncLogs()
  logs.unshift(log)
  if (logs.length > MAX_ENTRIES) {
    logs.length = MAX_ENTRIES
  }

  try {
    localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(logs))
  } catch {
    // Storage full — silently ignore
  }
}

/** 清除当前用户的所有同步日志 */
export function clearSyncLogs(): void {
  if (!currentUserId) return
  localStorage.removeItem(getStorageKey(currentUserId))
}
