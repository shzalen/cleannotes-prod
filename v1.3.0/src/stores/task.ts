import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type { Task, TaskStatus, TaskPriority, DeletedTask, HeatmapCell, HeatmapView } from '@/types'
import { getStorage } from '@/services/storage'
import { toUTCISO, toLocalDate } from '@/utils/time'
import { broadcastChange } from '@/services/crossTabSync'
import { clearLastSyncAt } from '@/services/syncState'

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 回收站自动清除天数 */
const TRASH_EXPIRE_DAYS = 7

/** XP 计算回调 — 由外部注入，避免循环依赖 */
let onTaskDoneCallback: ((task: Task) => void) | null = null

/** 设置任务完成时的 XP 计算回调 */
export function setOnTaskDone(cb: (task: Task) => void) {
  onTaskDoneCallback = cb
}

/** R3-P07: Clear task done callback (call on logout to prevent stale references) */
export function clearOnTaskDone() {
  onTaskDoneCallback = null
}

// ---- Debounced task writes (P4.3) ----
// UI updates are synchronous (Pinia); Supabase writes are debounced 300ms
// to coalesce rapid status toggles / edits into a single HTTP request.
const WRITE_DEBOUNCE_MS = 300
const pendingTaskWrites = new Map<string, Task>()
let writeTimer: ReturnType<typeof setTimeout> | null = null

// P-06: Retry queue for failed writes
const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000
const failedWrites = new Map<string, { task: Task; retries: number }>()

function scheduleTaskWrite(task: Task) {
  pendingTaskWrites.set(task.id, task)
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(flushTaskWrites, WRITE_DEBOUNCE_MS)
}

/** Retry a failed write with exponential backoff (P-06) */
function scheduleRetry(task: Task, retries: number) {
  const delay = RETRY_BASE_MS * Math.pow(2, retries)
  setTimeout(() => {
    const storage = getStorage()
    storage.upsertTask(task).then(() => {
      failedWrites.delete(task.id)
    }).catch(() => {
      if (retries + 1 < MAX_RETRIES) {
        scheduleRetry(task, retries + 1)
      } else {
        console.error(`[TaskStore] Failed to write task after ${MAX_RETRIES} retries: ${task.id}`)
        failedWrites.delete(task.id)
      }
    })
  }, delay)
}

/** Flush any pending debounced task writes immediately (e.g., before logout) */
export function flushTaskWrites() {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (pendingTaskWrites.size === 0) return
  const storage = getStorage()
  for (const task of pendingTaskWrites.values()) {
    storage.upsertTask(task).then(() => {
      failedWrites.delete(task.id)
    }).catch(() => {
      // P-06: Schedule retry with exponential backoff
      const existing = failedWrites.get(task.id)
      const retries = existing ? existing.retries : 0
      if (retries === 0) {
        failedWrites.set(task.id, { task, retries: 0 })
        scheduleRetry(task, 0)
      }
    })
  }
  pendingTaskWrites.clear()
  broadcastChange('tasks-updated')
}

// Flush on page hide (user switches tab / minimizes)
// R4-P02: Use named function so it can be explicitly removed
function onTaskVisibilityChange() {
  if (document.hidden) flushTaskWrites()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onTaskVisibilityChange)
}

/** R4-P02: Remove module-level visibilitychange listener (call on logout) */
export function cleanupTaskListeners() {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onTaskVisibilityChange)
  }
}

/** 格式化执行耗时 */
export function formatDuration(task: Task): string | null {
  if (!task.inProgressAt) return null
  const start = new Date(task.inProgressAt).getTime()
  const end = task.completedAt
    ? new Date(task.completedAt).getTime()
    : Date.now()
  if (isNaN(start) || isNaN(end)) return null
  const seconds = Math.floor((end - start) / 1000)
  if (seconds <= 0) return null
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const trash = ref<DeletedTask[]>([])
  const loaded = ref(false)
  const loadError = ref(false)  // 网络异常标记

  // P-08: Cache the load Promise to prevent race condition when multiple callers
  // call load() concurrently (e.g., App.vue init + cross-tab sync)
  let loadPromise: Promise<void> | null = null

  // P-10: Debounce rapid reload() calls (e.g., from multiple cross-tab sync events)
  // P1-04: Fix Promise leak — cache a single Deferred and resolve all waiters
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let reloadWaiters: (() => void)[] = []
  const RELOAD_DEBOUNCE_MS = 300

  // ---- 重新激活确认 ----

  const reactivateConfirm = reactive({
    visible: false,
    taskId: null as string | null,
    taskTitle: '',
    /** 可选：确认激活后额外应用的 patch（如时间字段 + 目标状态） */
    extraPatch: null as Partial<Task> | null,
  })

  // ---- 持久化 ----

  async function load(force = false) {
    // P-08: Return cached Promise if a load is already in-flight
    if (loadPromise && !force) return loadPromise

    const storage = getStorage()

    if (force) {
      clearLastSyncAt('tasks')
      clearLastSyncAt('deletedTasks')
    }

    // Full sync — always fetch all data.
    // Incremental sync was removed: pure-online architecture has no
    // client-side data cache to merge into (Pinia state resets on page refresh).
    loadPromise = (async () => {
      tasks.value = await storage.getTasks()

      // Sync deleted tasks (trash)
      try {
        await loadTrash()
      } catch {
        // trash sync failure is non-critical
      }

      await purgeExpired()
      loaded.value = true
      loadError.value = false
    })().catch((err) => {
      // R5-P03: Reset loadPromise on failure so subsequent load() can retry
      loadPromise = null
      loadError.value = true
      console.error('[TaskStore] load failed:', err)
    })

    return loadPromise
  }

  /** 全量保存 — 仅用于合并场景，日常 CRUD 请用 upsertTask/deleteTaskById */
  async function persist() {
    const storage = getStorage()
    await storage.saveTasks(tasks.value)
  }

  /** 重新加载（绕过 loaded 守卫，强制全量同步）— P-10: debounce 300ms */
  async function reload() {
    // P1-04: Collect all resolvers and resolve them all after the debounced reload completes
    return new Promise<void>((resolve) => {
      reloadWaiters.push(resolve)
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(async () => {
        reloadTimer = null
        loaded.value = false
        loadPromise = null
        try {
          await load(true)
        } finally {
          // Resolve all waiting callers regardless of success/failure
          const waiters = reloadWaiters
          reloadWaiters = []
          waiters.forEach(fn => fn())
        }
      }, RELOAD_DEBOUNCE_MS)
    })
  }

  async function loadTrash() {
    try {
      const storage = getStorage()
      trash.value = await storage.getDeletedTasks()
    } catch {
      trash.value = []
    }
  }

  /** 全量保存回收站 */
  async function persistTrash() {
    const storage = getStorage()
    await storage.saveDeletedTasks(trash.value)
  }

  /** 清除回收站中超过 7 天的项目 */
  async function purgeExpired() {
    const now = Date.now()
    const expireMs = TRASH_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    const before = trash.value.length
    const expiredIds: string[] = []
    trash.value = trash.value.filter(t => {
      const deletedTime = new Date(t.deletedAt).getTime()
      const isExpired = now - deletedTime >= expireMs
      if (isExpired) expiredIds.push(t.id)
      return !isExpired
    })
    if (trash.value.length !== before) {
      await persistTrash()
      // P-07: Batch delete expired records from both tables (single request each)
      const storage = getStorage()
      if (expiredIds.length > 0) {
        storage.deleteDeletedTasksByIds?.(expiredIds).catch(() => {})
        storage.deleteTasksByIds?.(expiredIds).catch(() => {})
      }
    }
  }

  // ---- 计算属性 ----

  const todoTasks = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter(t => t.status === 'done'))
  // P-14: recentTasks — Vue computed caches result, only recomputes on tasks change.
  // For typical personal use (100-500 tasks), O(n log n) sort is negligible.
  const recentTasks = computed(() =>
    [...tasks.value]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  )

  /** 回收站中即将过期的任务（3天内） */
  const expiringTrash = computed(() => {
    const now = Date.now()
    const warningMs = 3 * 24 * 60 * 60 * 1000
    return trash.value.filter(t => {
      const remaining = TRASH_EXPIRE_DAYS * 24 * 60 * 60 * 1000 - (now - new Date(t.deletedAt).getTime())
      return remaining <= warningMs
    })
  })

  // ---- 任务 CRUD（使用单记录持久化） ----

  function addTask(data: { title: string; description?: string; priority?: TaskPriority; dueDate?: string | null; startDate?: string | null; startTime?: string | null; tags?: string[]; createdAt?: string }) {
    const now = toUTCISO()
    const task: Task = {
      id: genId(),
      title: data.title,
      description: data.description ?? '',
      status: 'todo',
      priority: data.priority ?? 'medium',
      dueDate: data.dueDate ?? null,
      startDate: data.startDate ?? null,
      startTime: data.startTime ?? null,
      tags: data.tags ?? [],
      createdAt: data.createdAt ? toUTCISO(new Date(data.createdAt)) : now,
      updatedAt: now,
      completedAt: null,
      inProgressAt: null,
    }
    tasks.value.push(task)
    const storage = getStorage()
    storage.upsertTask(task).catch(() => {})
    broadcastChange('tasks-updated')
    return task
  }

  function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'startDate' | 'startTime' | 'tags' | 'inProgressAt' | 'completedAt'>>) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const wasDone = tasks.value[idx].status === 'done'
    const now = toUTCISO()
    Object.assign(tasks.value[idx], patch, { updatedAt: now })
    if (patch.status === 'in_progress' && !('inProgressAt' in patch)) {
      tasks.value[idx].inProgressAt = now
    }
    if (patch.status === 'done' && !('completedAt' in patch) && !tasks.value[idx].completedAt) {
      tasks.value[idx].completedAt = now
    }
    const storage = getStorage()
    scheduleTaskWrite(tasks.value[idx])
    if (patch.status === 'done' && !wasDone && onTaskDoneCallback) {
      // R5-P02: Catch async rejection to prevent unhandled promise rejection
      Promise.resolve(onTaskDoneCallback(tasks.value[idx])).catch((err) => {
        console.error('[task] onTaskDone callback failed:', err)
      })
    }
  }

  /** 将任务移入回收站（已完成任务不允许删除，由调用方判断） */
  function deleteTask(id: string): boolean {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return false
    if (task.status === 'done') return false

    const deletedTask: DeletedTask = {
      ...task,
      deletedAt: toUTCISO(),
    }
    trash.value.unshift(deletedTask)
    void (async () => {
      const storage = getStorage()
      await storage.upsertDeletedTask(deletedTask).catch(() => {})
    })()
    tasks.value = tasks.value.filter(t => t.id !== id)
    const storage = getStorage()
    storage.deleteTaskById(id).catch(() => {})
    broadcastChange('tasks-updated')
    return true
  }

  function toggleStatus(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
    updateTask(id, { status: next[task.status] })
  }

  function requestToggleStatus(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    if (task.status === 'done') {
      reactivateConfirm.taskId = id
      reactivateConfirm.taskTitle = task.title
      reactivateConfirm.visible = true
      return
    }
    toggleStatus(id)
  }

  function confirmReactivate() {
    if (reactivateConfirm.taskId) {
      if (reactivateConfirm.extraPatch) {
        updateTask(reactivateConfirm.taskId, reactivateConfirm.extraPatch as any)
      } else {
        toggleStatus(reactivateConfirm.taskId)
      }
    }
    reactivateConfirm.visible = false
    reactivateConfirm.taskId = null
    reactivateConfirm.taskTitle = ''
    reactivateConfirm.extraPatch = null
  }

  function cancelReactivate() {
    reactivateConfirm.visible = false
    reactivateConfirm.taskId = null
    reactivateConfirm.taskTitle = ''
    reactivateConfirm.extraPatch = null
  }

  // ---- 回收站操作 ----

  /** 恢复任务到主列表 */
  function restoreTask(id: string) {
    const idx = trash.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const { deletedAt: _, ...taskData } = trash.value[idx]
    const task: Task = { ...taskData }
    tasks.value.unshift(task)
    const storage = getStorage()
    storage.upsertTask(task).catch(() => {})
    storage.deleteDeletedTaskById(id).catch(() => {})
    trash.value.splice(idx, 1)
  }

  /** 从回收站永久删除 */
  function permanentDelete(id: string) {
    trash.value = trash.value.filter(t => t.id !== id)
    const storage = getStorage()
    storage.deleteDeletedTaskById(id).catch(() => {})
    storage.deleteTaskById(id).catch(() => {})
  }

  /** 清空回收站 — P-07: batch delete */
  function emptyTrash() {
    const ids = trash.value.map(t => t.id)
    trash.value = []
    const storage = getStorage()
    if (ids.length > 0) {
      storage.deleteDeletedTasksByIds?.(ids).catch(() => {})
      storage.deleteTasksByIds?.(ids).catch(() => {})
    }
  }

  /** 计算回收站中某任务剩余天数 */
  function getRemainingDays(deletedAt: string): number {
    const now = Date.now()
    const deletedTime = new Date(deletedAt).getTime()
    const expireMs = TRASH_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((expireMs - (now - deletedTime)) / (24 * 60 * 60 * 1000)))
  }

  // ---- 热力图 ----

  function getHeatmapData(view: HeatmapView): HeatmapCell[] {
    const now = new Date()
    const cells: HeatmapCell[] = []

    const countMap = new Map<string, number>()
    for (const t of tasks.value) {
      const d = (t.startDate || t.createdAt.slice(0, 10))
      countMap.set(d, (countMap.get(d) ?? 0) + 1)
    }

    let start: Date
    if (view === 'year') {
      start = new Date(now.getFullYear(), 0, 1)
    } else if (view === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      const day = now.getDay() || 7
      start = new Date(now)
      start.setDate(now.getDate() - day + 1)
    }

    const end = view === 'week'
      ? new Date(start.getTime() + 6 * 86400000)
      : view === 'month'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
        : new Date(now.getFullYear(), 11, 31)

    const d = new Date(start)
    while (d <= end) {
      const key = toLocalDate(d)
      const count = countMap.get(key) ?? 0
      const level: HeatmapCell['level'] = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4
      cells.push({ date: key, count, level })
      d.setDate(d.getDate() + 1)
    }

    return cells
  }

  return {
    tasks, trash, loaded, loadError, reactivateConfirm,
    todoTasks, inProgressTasks, doneTasks, recentTasks, expiringTrash,
    load, reload, persist, persistTrash,
    addTask, updateTask, deleteTask, toggleStatus,
    requestToggleStatus, confirmReactivate, cancelReactivate,
    restoreTask, permanentDelete, emptyTrash, getRemainingDays, purgeExpired,
    getHeatmapData,
  }
})
