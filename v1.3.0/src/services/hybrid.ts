/**
 * Hybrid Storage Adapter — 增量同步 + 离线优先 + 多终端合并
 *
 * 核心改造（v3）：
 * - 单记录操作：CRUD 通过 upsertTask/deleteTaskById 等方法，不再全量替换
 * - 云端合并：登录时从 Supabase 拉取数据，与本地合并后再加载
 * - 脏标记：单记录粒度，记录需要重试的 upsert/delete 操作
 * - RLS：所有请求带 x-user-id header
 */

import { ref } from 'vue'
import type { StorageAdapter } from './storage'
import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig } from '@/types'
import { supabaseAdapter } from './supabase'
import { localAdapter } from './local'
import { setSyncLogUserId, appendSyncLog } from './syncLog'
import { SUPABASE_URL, SUPABASE_KEY } from './supabase'
import { toUTCISO } from '@/utils/time'

// ---- Reactive state ----

export const isOnline = ref(true)
export const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')
export const lastSyncAt = ref<string>('')

// ---- User context ----

let currentUserId = ''

// ---- Tombstone tracking (permanently deleted task IDs) ----
// When a task is permanently deleted (from trash or expired), its ID is recorded
// here. This prevents the task from being restored during sync if the Supabase
// delete from cleannote_tasks failed and the recycle bin record is also gone.

const TOMBSTONE_MAX_AGE_DAYS = 90

function getTombstoneKey(): string {
  return currentUserId ? `cleannotes_tombstones_${currentUserId}` : 'cleannotes_tombstones'
}

/** Get all tombstone IDs as a Set */
export function getTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(getTombstoneKey())
    if (!raw) return new Set()
    const obj: Record<string, string> = JSON.parse(raw)
    return new Set(Object.keys(obj))
  } catch {
    return new Set()
  }
}

/** Add task IDs to the tombstone set */
export function addTombstones(ids: string[]): void {
  if (ids.length === 0) return
  try {
    const raw = localStorage.getItem(getTombstoneKey())
    const obj: Record<string, string> = raw ? JSON.parse(raw) : {}
    const now = toUTCISO()
    for (const id of ids) {
      obj[id] = now
    }
    localStorage.setItem(getTombstoneKey(), JSON.stringify(obj))
  } catch {}
}

/** Remove task IDs from the tombstone set (e.g. when restoring a task) */
export function removeTombstones(ids: string[]): void {
  if (ids.length === 0) return
  try {
    const raw = localStorage.getItem(getTombstoneKey())
    if (!raw) return
    const obj: Record<string, string> = JSON.parse(raw)
    let changed = false
    for (const id of ids) {
      if (id in obj) {
        delete obj[id]
        changed = true
      }
    }
    if (changed) {
      if (Object.keys(obj).length === 0) {
        localStorage.removeItem(getTombstoneKey())
      } else {
        localStorage.setItem(getTombstoneKey(), JSON.stringify(obj))
      }
    }
  } catch {}
}

/** Remove tombstone entries older than TOMBSTONE_MAX_AGE_DAYS */
function cleanOldTombstones(): void {
  try {
    const raw = localStorage.getItem(getTombstoneKey())
    if (!raw) return
    const obj: Record<string, string> = JSON.parse(raw)
    const cutoff = Date.now() - TOMBSTONE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    let changed = false
    for (const [id, ts] of Object.entries(obj)) {
      if (new Date(ts).getTime() < cutoff) {
        delete obj[id]
        changed = true
      }
    }
    if (changed) {
      if (Object.keys(obj).length === 0) {
        localStorage.removeItem(getTombstoneKey())
      } else {
        localStorage.setItem(getTombstoneKey(), JSON.stringify(obj))
      }
    }
  } catch {}
}

// ---- Dirty operation tracking (per-record granularity) ----

interface DirtyOp {
  type: 'upsert_task' | 'delete_task' | 'upsert_deleted_task' | 'delete_deleted_task'
       | 'upsert_ai_message' | 'delete_ai_message' | 'delete_all_ai_messages'
       | 'save_timer_config' | 'save_ai_config' | 'save_tasks' | 'save_deleted_tasks' | 'save_ai_messages'
  data?: any
  id?: string
}

function getDirtyQueueKey(): string {
  return currentUserId ? `cleannotes_dirty_queue_${currentUserId}` : 'cleannotes_dirty_queue'
}

function getDirtyQueue(): DirtyOp[] {
  try {
    const raw = localStorage.getItem(getDirtyQueueKey())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function pushDirtyOp(op: DirtyOp) {
  const queue = getDirtyQueue()
  queue.push(op)
  localStorage.setItem(getDirtyQueueKey(), JSON.stringify(queue))
}

function clearDirtyQueue() {
  localStorage.removeItem(getDirtyQueueKey())
}

/** Remove successfully synced ops (by index) */
function removeDirtyOps(indices: number[]) {
  if (indices.length === 0) return
  const queue = getDirtyQueue()
  const remaining = queue.filter((_, i) => !indices.includes(i))
  if (remaining.length === 0) {
    clearDirtyQueue()
  } else {
    localStorage.setItem(getDirtyQueueKey(), JSON.stringify(remaining))
  }
}

// ---- Health check ----

let healthCheckTimer: ReturnType<typeof setInterval> | null = null
const HEALTH_CHECK_INTERVAL = 15_000 // 15 seconds

async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    // PostgREST 不支持对 /rest/v1/ 根路径发 HEAD 请求，改用 limit=0 的 GET
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cleannote_tasks?limit=0`, {
      method: 'GET',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'x-user-id': currentUserId },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // 200/206 表示连通；401/403 表示认证问题但也说明服务可达
    return res.status < 500
  } catch {
    return false
  }
}

// ---- Auto sync (replay dirty operations) ----

async function syncDirtyOps(): Promise<void> {
  if (!currentUserId) return
  const queue = getDirtyQueue()
  if (queue.length === 0) return

  syncStatus.value = 'syncing'
  const syncedIndices: number[] = []

  try {
    for (let i = 0; i < queue.length; i++) {
      const op = queue[i]
      try {
        switch (op.type) {
          case 'upsert_task':
            await supabaseAdapter.upsertTask(op.data as Task)
            break
          case 'delete_task':
            await supabaseAdapter.deleteTaskById(op.id!)
            break
          case 'upsert_deleted_task':
            await supabaseAdapter.upsertDeletedTask(op.data as DeletedTask)
            break
          case 'delete_deleted_task':
            await supabaseAdapter.deleteDeletedTaskById(op.id!)
            break
          case 'upsert_ai_message':
            await supabaseAdapter.upsertAiMessage(op.data as AiMessage)
            break
          case 'delete_ai_message':
            await supabaseAdapter.deleteAiMessageById(op.id!)
            break
          case 'delete_all_ai_messages':
            await supabaseAdapter.deleteAllAiMessages()
            break
          case 'save_timer_config':
            await supabaseAdapter.saveTimerConfig(op.data as TimerConfig)
            break
          case 'save_ai_config':
            await supabaseAdapter.saveAiConfig(op.data as AiConfig)
            break
          case 'save_tasks':
            await supabaseAdapter.saveTasks(op.data as Task[])
            break
          case 'save_deleted_tasks':
            await supabaseAdapter.saveDeletedTasks(op.data as DeletedTask[])
            break
          case 'save_ai_messages':
            await supabaseAdapter.saveAiMessages(op.data as AiMessage[])
            break
        }
        syncedIndices.push(i)
      } catch {
        // Individual op failed, skip and keep in queue for next retry
        break // Stop on first failure — likely a connectivity issue
      }
    }

    removeDirtyOps(syncedIndices)
    syncStatus.value = 'idle'
  } catch {
    syncStatus.value = 'error'
  }
}

async function healthCheckLoop() {
  const wasOnline = isOnline.value
  const reachable = await checkSupabaseHealth()
  isOnline.value = reachable

  if (reachable && (!wasOnline || getDirtyQueue().length > 0)) {
    await syncDirtyOps()
  }
}

function startHealthCheck() {
  if (healthCheckTimer) return
  healthCheckLoop()
  healthCheckTimer = setInterval(healthCheckLoop, HEALTH_CHECK_INTERVAL)
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer)
    healthCheckTimer = null
  }
}

// ---- Merge from cloud (login-time sync) ----

/**
 * 云端→本地双向合并：
 * 1. 从云端拉取全量数据
 * 2. 从本地读取全量数据
 * 3. 按 id 合并：仅云端有→拉到本地，仅本地有→上传到云端，都有→updatedAt 新者胜出
 * 4. 写入前重新读取本地最新数据，避免覆盖并行用户操作
 * 5. 将合并结果写回本地和云端
 * 
 * @returns true if local data was changed (caller should refresh stores)
 */
export async function mergeFromCloud(): Promise<boolean> {
  if (!currentUserId) return false
  syncStatus.value = 'syncing'

  try {
    // ---- Fetch all data in parallel ----
    const [cloudTasks, cloudDeleted, cloudMsgs, cloudTimer, cloudAiConfig] = await Promise.all([
      supabaseAdapter.getTasks().catch(() => [] as Task[]),
      supabaseAdapter.getDeletedTasks().catch(() => [] as DeletedTask[]),
      supabaseAdapter.getAiMessages().catch(() => [] as AiMessage[]),
      supabaseAdapter.getTimerConfig().catch(() => null as TimerConfig | null),
      supabaseAdapter.getAiConfig().catch(() => null as AiConfig | null),
    ])

    // ---- Re-read fresh local data (避免覆盖并行用户操作) ----
    const [freshLocalTasks, freshLocalDeleted, freshLocalMsgs, freshLocalTimer, freshLocalAiConfig] = await Promise.all([
      localAdapter.getTasks(),
      localAdapter.getDeletedTasks(),
      localAdapter.getAiMessages(),
      localAdapter.getTimerConfig(),
      localAdapter.getAiConfig(),
    ])

    // ---- Merge Tasks (excluding IDs that are in the recycle bin or tombstoned) ----
    const deletedIdsSet = new Set([
      ...cloudDeleted.map(t => t.id),
      ...freshLocalDeleted.map(t => t.id),
    ])

    const tombstoneSet = getTombstones()

    const filteredCloudTasks = cloudTasks.filter(t => !deletedIdsSet.has(t.id) && !tombstoneSet.has(t.id))
    const filteredLocalTasks = freshLocalTasks.filter(t => !deletedIdsSet.has(t.id) && !tombstoneSet.has(t.id))

    // Clean up orphaned records
    const excludedIds = new Set([...deletedIdsSet, ...tombstoneSet])
    const orphanedIds = cloudTasks.filter(t => excludedIds.has(t.id)).map(t => t.id)
    for (const id of orphanedIds) {
      supabaseAdapter.deleteTaskById(id).catch(() => {})
    }

    let hasChanges = false

    if (filteredCloudTasks.length > 0 || filteredLocalTasks.length > 0) {
      const merged = mergeRecords(filteredLocalTasks, filteredCloudTasks, (a, b) => a.updatedAt.localeCompare(b.updatedAt))
      await localAdapter.saveTasks(merged.local)
      hasChanges = merged.local.length !== freshLocalTasks.length ||
        merged.local.some((t, i) => {
          const fl = freshLocalTasks[i]
          if (!fl) return true
          const allKeys = new Set([...Object.keys(fl), ...Object.keys(t)])
          return [...allKeys].some(k => (fl as any)[k] !== (t as any)[k])
        })
      if (merged.toUpload.length > 0) {
        await supabaseAdapter.saveTasks(merged.toUpload).catch(() => {
          pushDirtyOp({ type: 'save_tasks', data: merged.toUpload })
        })
      }
    } else {
      if (freshLocalTasks.length > 0) {
        await localAdapter.saveTasks([])
        hasChanges = true
      }
    }

    // ---- Merge Deleted Tasks ----
    if (cloudDeleted.length > 0 || freshLocalDeleted.length > 0) {
      const merged = mergeRecords(freshLocalDeleted, cloudDeleted, (a, b) => a.deletedAt.localeCompare(b.deletedAt))
      await localAdapter.saveDeletedTasks(merged.local)
      if (merged.toUpload.length > 0) {
        await supabaseAdapter.saveDeletedTasks(merged.toUpload).catch(() => {
          pushDirtyOp({ type: 'save_deleted_tasks', data: merged.toUpload })
        })
      }
    }

    // ---- Merge AI Messages ----
    if (cloudMsgs.length > 0 || freshLocalMsgs.length > 0) {
      const merged = mergeRecords(freshLocalMsgs, cloudMsgs, (a, b) => a.timestamp.localeCompare(b.timestamp))
      await localAdapter.saveAiMessages(merged.local)
      if (merged.toUpload.length > 0) {
        await supabaseAdapter.saveAiMessages(merged.toUpload).catch(() => {
          pushDirtyOp({ type: 'save_ai_messages', data: merged.toUpload })
        })
      }
    }

    // ---- Timer Config (cloud wins if both exist) ----
    if (cloudTimer && !freshLocalTimer) {
      await localAdapter.saveTimerConfig(cloudTimer)
    } else if (freshLocalTimer && !cloudTimer) {
      await supabaseAdapter.saveTimerConfig(freshLocalTimer).catch(() => {
        pushDirtyOp({ type: 'save_timer_config', data: freshLocalTimer })
      })
    } else if (cloudTimer && freshLocalTimer) {
      // Both exist: cloud wins per declared strategy
      await localAdapter.saveTimerConfig(cloudTimer)
    }

    // ---- AI Config (cloud wins if both exist) ----
    if (cloudAiConfig && !freshLocalAiConfig) {
      await localAdapter.saveAiConfig(cloudAiConfig)
    } else if (freshLocalAiConfig && !cloudAiConfig) {
      await supabaseAdapter.saveAiConfig(freshLocalAiConfig).catch(() => {
        pushDirtyOp({ type: 'save_ai_config', data: freshLocalAiConfig })
      })
    } else if (cloudAiConfig && freshLocalAiConfig) {
      // Both exist: cloud wins per declared strategy
      await localAdapter.saveAiConfig(cloudAiConfig)
    }

    isOnline.value = true
    syncStatus.value = 'idle'
    saveLastSyncAt(toUTCISO())

    // Log sync result
    const taskChanges = filteredCloudTasks.length + filteredLocalTasks.length > 0
    appendSyncLog({
      type: 'full_merge',
      summary: hasChanges
        ? `全量合并完成，处理了 ${filteredCloudTasks.length} 个云端任务${orphanedIds.length > 0 ? `（清理 ${orphanedIds.length} 个孤立记录）` : ''}`
        : '全量合并完成，无差异',
      tasksSynced: filteredCloudTasks.length,
      deletedSynced: cloudDeleted.length + freshLocalDeleted.length,
      memosSynced: 0,
      todosSynced: 0,
      reportsSynced: 0,
      status: 'success',
    })

    return hasChanges
  } catch (err: any) {
    syncStatus.value = 'error'

    appendSyncLog({
      type: 'error',
      summary: '全量合并失败',
      tasksSynced: 0,
      deletedSynced: 0,
      memosSynced: 0,
      todosSynced: 0,
      reportsSynced: 0,
      status: 'failed',
      errorMsg: err?.message || String(err),
    })

    return false
  }
}

// ---- Incremental sync (periodic pull from cloud) ----

/** Persist and load lastSyncAt per user */
function getLastSyncAtKey(): string {
  return currentUserId ? `cleannotes_last_sync_at_${currentUserId}` : 'cleannotes_last_sync_at'
}

function loadLastSyncAt(): string {
  try {
    return localStorage.getItem(getLastSyncAtKey()) || ''
  } catch {
    return ''
  }
}

function saveLastSyncAt(ts: string): void {
  lastSyncAt.value = ts
  try {
    localStorage.setItem(getLastSyncAtKey(), ts)
  } catch {}
}

/** 增量同步：从 Supabase 拉取远端变更，返回需要应用到 store 的差异 */
export interface RemoteChanges {
  /** 云端新增或更新的任务（本地不存在或 updatedAt 更旧） */
  updatedTasks: Task[]
  /** 本地存在但云端不存在的任务 ID（远端已删除） */
  deletedTaskIds: string[]
  /** 云端新增或更新的回收站任务 */
  updatedDeletedTasks: DeletedTask[]
  /** 本地存在但云端不存在的回收站任务 ID */
  deletedDeletedTaskIds: string[]
  /** 云端新增或更新的 AI 消息 */
  updatedAiMessages: AiMessage[]
  /** 本地存在但云端不存在的 AI 消息 ID */
  deletedAiMessageIds: string[]
}

export async function fetchRemoteChanges(): Promise<RemoteChanges | null> {
  if (!currentUserId) return null

  try {
    // 并行拉取云端和本地数据
    const [cloudTasks, cloudDeleted, cloudMsgs, localTasks, localDeleted, localMsgs] = await Promise.all([
      supabaseAdapter.getTasks().catch(() => [] as Task[]),
      supabaseAdapter.getDeletedTasks().catch(() => [] as DeletedTask[]),
      supabaseAdapter.getAiMessages().catch(() => [] as AiMessage[]),
      localAdapter.getTasks(),
      localAdapter.getDeletedTasks(),
      localAdapter.getAiMessages(),
    ])

    // ---- Compute task diff ----
    // Build a set of pending task IDs from the dirty queue — these are tasks
    // that failed to sync to cloud and will be retried. They should NOT be
    // treated as "remote deleted" just because cloud doesn't have them yet.
    const dirtyQueue = getDirtyQueue()
    const pendingSyncTaskIds = new Set(
      dirtyQueue
        .filter(op => op.type === 'upsert_task')
        .map(op => (op.data as Task).id)
    )

    // Build a set of IDs that are in the deleted_tasks table (recycle bin).
    // Any task present in deleted_tasks should NOT be restored to the main list.
    const deletedTaskIdsSet = new Set(cloudDeleted.map(t => t.id))

    // Also check tombstones — permanently deleted tasks must not be restored
    const tombstoneSet = getTombstones()

    const localTaskMap = new Map(localTasks.map(t => [t.id, t]))
    const cloudTaskMap = new Map(cloudTasks.map(t => [t.id, t]))
    const updatedTasks: Task[] = []
    const deletedTaskIds: string[] = []

    for (const [id, cloudTask] of cloudTaskMap) {
      // Skip tasks that are already in the recycle bin — they were deleted, not new
      if (deletedTaskIdsSet.has(id)) continue
      // Skip tombstoned tasks — they were permanently deleted
      if (tombstoneSet.has(id)) continue
      const localTask = localTaskMap.get(id)
      if (!localTask || cloudTask.updatedAt > localTask.updatedAt) {
        updatedTasks.push(cloudTask)
      }
    }
    // Clean up orphaned cloud tasks: if a task ID exists in both cleannote_tasks
    // and cleannote_deleted_tasks or is tombstoned, it means the delete from
    // cleannote_tasks failed. Remove these orphans from the cloud tasks table.
    const allExcludedIds = new Set([...deletedTaskIdsSet, ...tombstoneSet])
    const orphanedTaskIds: string[] = []
    for (const id of allExcludedIds) {
      if (cloudTaskMap.has(id)) {
        orphanedTaskIds.push(id)
      }
    }
    if (orphanedTaskIds.length > 0) {
      // Fire-and-forget cleanup — don't block the sync cycle
      for (const id of orphanedTaskIds) {
        supabaseAdapter.deleteTaskById(id).catch(() => {})
      }
    }
    for (const id of localTaskMap.keys()) {
      if (!cloudTaskMap.has(id) && !pendingSyncTaskIds.has(id)) {
        deletedTaskIds.push(id)
      }
    }

    // ---- Compute deleted task diff ----
    const localDeletedMap = new Map(localDeleted.map(t => [t.id, t]))
    const cloudDeletedMap = new Map(cloudDeleted.map(t => [t.id, t]))
    const updatedDeletedTasks: DeletedTask[] = []
    const deletedDeletedTaskIds: string[] = []

    for (const [id, cloudTask] of cloudDeletedMap) {
      const localTask = localDeletedMap.get(id)
      if (!localTask || cloudTask.deletedAt > localTask.deletedAt) {
        updatedDeletedTasks.push(cloudTask)
      }
    }
    for (const id of localDeletedMap.keys()) {
      if (!cloudDeletedMap.has(id)) {
        deletedDeletedTaskIds.push(id)
      }
    }

    // ---- Compute AI message diff ----
    const localMsgMap = new Map(localMsgs.map(m => [m.id, m]))
    const cloudMsgMap = new Map(cloudMsgs.map(m => [m.id, m]))
    const updatedAiMessages: AiMessage[] = []
    const deletedAiMessageIds: string[] = []

    for (const [id, cloudMsg] of cloudMsgMap) {
      const localMsg = localMsgMap.get(id)
      if (!localMsg || cloudMsg.timestamp > localMsg.timestamp) {
        updatedAiMessages.push(cloudMsg)
      }
    }
    for (const id of localMsgMap.keys()) {
      if (!cloudMsgMap.has(id)) {
        deletedAiMessageIds.push(id)
      }
    }

    // Update lastSyncAt
    saveLastSyncAt(toUTCISO())
    isOnline.value = true

    return {
      updatedTasks, deletedTaskIds,
      updatedDeletedTasks, deletedDeletedTaskIds,
      updatedAiMessages, deletedAiMessageIds,
    }
  } catch {
    isOnline.value = false
    return null
  }
}

/** Generic merge: local + cloud → merged result */
function mergeRecords<T extends { id: string }>(
  local: T[],
  cloud: T[],
  compareUpdate: (a: T, b: T) => number  // >0 means b is newer
): { local: T[]; toUpload: T[] } {
  const localMap = new Map(local.map(r => [r.id, r]))
  const cloudMap = new Map(cloud.map(r => [r.id, r]))
  const merged: T[] = []
  const toUpload: T[] = []

  // Start with all cloud records
  for (const [id, cloudRec] of cloudMap) {
    const localRec = localMap.get(id)
    if (!localRec) {
      // Only in cloud → keep cloud version
      merged.push(cloudRec)
    } else {
      // Both exist → keep newer; when timestamps tie, merge fields (cloud base + local override)
      const cmp = compareUpdate(localRec, cloudRec)
      if (cmp > 0) {
        merged.push(cloudRec)
      } else if (cmp < 0) {
        merged.push(localRec)
      } else {
        merged.push({ ...cloudRec, ...localRec } as T)
      }
    }
  }

  // Local-only records → keep in merged + upload to cloud
  for (const [id, localRec] of localMap) {
    if (!cloudMap.has(id)) {
      merged.push(localRec)
      toUpload.push(localRec)
    }
  }

  return { local: merged, toUpload }
}

// ---- Hybrid adapter ----

export const hybridAdapter: StorageAdapter = {

  setUserId(userId: string) {
    currentUserId = userId
    supabaseAdapter.setUserId(userId)
    localAdapter.setUserId(userId)
    setSyncLogUserId(userId)
    // Load persisted lastSyncAt
    lastSyncAt.value = loadLastSyncAt()
    // Clean up old tombstones on user switch
    cleanOldTombstones()
  },

  // ========== Tasks ==========

  /** 本地优先：本地是 ground truth，仅本地为空时才从云端加载 */
  async getTasks(): Promise<Task[]> {
    const local = await localAdapter.getTasks()
    if (local.length > 0) return local
    // 本地为空（首次登录 / 新设备）→ 尝试从云端加载
    try {
      const tasks = await supabaseAdapter.getTasks()
      isOnline.value = true
      return tasks
    } catch {
      isOnline.value = false
      return []
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    await localAdapter.saveTasks(tasks)
    try {
      await supabaseAdapter.saveTasks(tasks)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'save_tasks', data: tasks })
    }
  },

  async upsertTask(task: Task): Promise<void> {
    await localAdapter.upsertTask(task)
    try {
      await supabaseAdapter.upsertTask(task)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'upsert_task', data: task })
    }
  },

  async deleteTaskById(id: string): Promise<void> {
    await localAdapter.deleteTaskById(id)
    try {
      await supabaseAdapter.deleteTaskById(id)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'delete_task', id })
    }
  },

  // ========== Deleted Tasks ==========

  async getDeletedTasks(): Promise<DeletedTask[]> {
    try {
      const tasks = await supabaseAdapter.getDeletedTasks()
      isOnline.value = true
      return tasks
    } catch {
      isOnline.value = false
      return localAdapter.getDeletedTasks()
    }
  },

  async saveDeletedTasks(tasks: DeletedTask[]): Promise<void> {
    await localAdapter.saveDeletedTasks(tasks)
    try {
      await supabaseAdapter.saveDeletedTasks(tasks)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'save_deleted_tasks', data: tasks })
    }
  },

  async upsertDeletedTask(task: DeletedTask): Promise<void> {
    await localAdapter.upsertDeletedTask(task)
    try {
      await supabaseAdapter.upsertDeletedTask(task)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'upsert_deleted_task', data: task })
    }
  },

  async deleteDeletedTaskById(id: string): Promise<void> {
    await localAdapter.deleteDeletedTaskById(id)
    try {
      await supabaseAdapter.deleteDeletedTaskById(id)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'delete_deleted_task', id })
    }
  },

  // ========== Timer Config ==========

  async getTimerConfig(): Promise<TimerConfig | null> {
    try {
      const config = await supabaseAdapter.getTimerConfig()
      isOnline.value = true
      return config
    } catch {
      isOnline.value = false
      return localAdapter.getTimerConfig()
    }
  },

  async saveTimerConfig(config: TimerConfig): Promise<void> {
    await localAdapter.saveTimerConfig(config)
    try {
      await supabaseAdapter.saveTimerConfig(config)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'save_timer_config', data: config })
    }
  },

  // ========== AI Messages ==========

  async getAiMessages(): Promise<AiMessage[]> {
    try {
      const msgs = await supabaseAdapter.getAiMessages()
      isOnline.value = true
      return msgs
    } catch {
      isOnline.value = false
      return localAdapter.getAiMessages()
    }
  },

  async saveAiMessages(messages: AiMessage[]): Promise<void> {
    await localAdapter.saveAiMessages(messages)
    try {
      await supabaseAdapter.saveAiMessages(messages)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'save_ai_messages', data: messages })
    }
  },

  async upsertAiMessage(msg: AiMessage): Promise<void> {
    await localAdapter.upsertAiMessage(msg)
    try {
      await supabaseAdapter.upsertAiMessage(msg)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'upsert_ai_message', data: msg })
    }
  },

  async deleteAiMessageById(id: string): Promise<void> {
    await localAdapter.deleteAiMessageById(id)
    try {
      await supabaseAdapter.deleteAiMessageById(id)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'delete_ai_message', id })
    }
  },

  async deleteAllAiMessages(): Promise<void> {
    await localAdapter.deleteAllAiMessages()
    try {
      await supabaseAdapter.deleteAllAiMessages()
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'delete_all_ai_messages' })
    }
  },

  // ========== AI Config ==========

  async getAiConfig(): Promise<AiConfig | null> {
    try {
      const config = await supabaseAdapter.getAiConfig()
      isOnline.value = true
      return config
    } catch {
      isOnline.value = false
      return localAdapter.getAiConfig()
    }
  },

  async saveAiConfig(config: AiConfig): Promise<void> {
    await localAdapter.saveAiConfig(config)
    try {
      await supabaseAdapter.saveAiConfig(config)
      isOnline.value = true
    } catch {
      isOnline.value = false
      pushDirtyOp({ type: 'save_ai_config', data: config })
    }
  },
}

// Start health check on import
startHealthCheck()

export { startHealthCheck, stopHealthCheck }
