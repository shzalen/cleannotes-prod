import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type { Task, TaskStatus, TaskPriority, DeletedTask, HeatmapCell, HeatmapView } from '@/types'
import { getStorage } from '@/services/storage'
import { localAdapter } from '@/services/local'
import { addTombstones, getTombstones, removeTombstones } from '@/services/hybrid'
import { toUTCISO, toLocalDate, normalizeTimestamp } from '@/utils/time'

function genId(): string {
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

/** 格式化执行耗时 */
export function formatDuration(task: Task): string | null {
  if (!task.inProgressAt) return null
  const start = new Date(task.inProgressAt).getTime()
  const end = task.completedAt
    ? new Date(task.completedAt).getTime()
    : Date.now()
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

  // ---- 重新激活确认 ----

  const reactivateConfirm = reactive({
    visible: false,
    taskId: null as string | null,
    taskTitle: '',
    /** 可选：确认激活后额外应用的 patch（如时间字段 + 目标状态） */
    extraPatch: null as Partial<Task> | null,
  })

  // ---- 持久化 ----

  async function load() {
    if (loaded.value) return
    const storage = getStorage()
    tasks.value = await storage.getTasks()
    await loadTrash()
    await purgeExpired()
    loaded.value = true
  }

  /** 全量保存 — 仅用于合并场景，日常 CRUD 请用 upsertTask/deleteTaskById */
  async function persist() {
    const storage = getStorage()
    await storage.saveTasks(tasks.value)
  }

  /** 重新加载（绕过 loaded 守卫，用于 mergeFromCloud 后刷新 UI） */
  async function reload() {
    loaded.value = false
    await load()
  }

  async function loadTrash() {
    try {
      const storage = getStorage()
      const allDeleted = await storage.getDeletedTasks()
      // Filter out permanently deleted (tombstoned) items from the trash display
      const tombstones = getTombstones()
      trash.value = allDeleted.filter(t => !tombstones.has(t.id))
    } catch {
      trash.value = []
    }
  }

  /** 全量保存回收站 — 仅用于合并场景 */
  async function persistTrash() {
    try {
      const storage = getStorage()
      await storage.saveDeletedTasks(trash.value)
    } catch {
      // 回退到 localStorage 以保证数据不丢失
      const sessionRaw = localStorage.getItem('cleannote_session')
      const userId = sessionRaw ? (JSON.parse(sessionRaw).userId ?? '') : ''
      const key = userId ? `cleannotes_${userId}_deleted_tasks` : 'cleannotes_deleted_tasks'
      localStorage.setItem(key, JSON.stringify(trash.value))
    }
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
      // Record tombstones so these tasks can never be restored via sync
      addTombstones(expiredIds)
      // Delete expired records from both tables on Supabase
      const storage = getStorage()
      for (const id of expiredIds) {
        storage.deleteDeletedTaskById(id).catch(() => {})
        // Defensive: also ensure the task is removed from cleannote_tasks
        storage.deleteTaskById(id).catch(() => {})
      }
    }
  }

  // ---- 计算属性 ----

  const todoTasks = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter(t => t.status === 'done'))
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
    // 单条 upsert，不再全量保存
    const storage = getStorage()
    storage.upsertTask(task).catch(() => {})
    return task
  }

  function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'startDate' | 'startTime' | 'tags' | 'inProgressAt' | 'completedAt'>>) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const wasDone = tasks.value[idx].status === 'done'
    const now = toUTCISO()
    Object.assign(tasks.value[idx], patch, { updatedAt: now })
    // 状态变为"进行中"时记录实际开始时间（仅在用户未显式传入 inProgressAt 时自动填充）
    if (patch.status === 'in_progress' && !('inProgressAt' in patch)) {
      tasks.value[idx].inProgressAt = now
    }
    // 状态变为"已完成"时记录完成时间（仅在用户未显式传入 completedAt 时自动填充）
    if (patch.status === 'done' && !('completedAt' in patch) && !tasks.value[idx].completedAt) {
      tasks.value[idx].completedAt = now
    }
    // 单条 upsert
    const storage = getStorage()
    storage.upsertTask(tasks.value[idx]).catch(() => {})
    // 触发 XP 计算：从未完成 → 完成
    if (patch.status === 'done' && !wasDone && onTaskDoneCallback) {
      onTaskDoneCallback(tasks.value[idx])
    }
  }

  /** 将任务移入回收站（已完成任务不允许删除，由调用方判断） */
  function deleteTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    if (task.status === 'done') return // 已完成不允许删除

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
    // 单条删除 + 单条 upsert deleted task
    const storage = getStorage()
    storage.deleteTaskById(id).catch(() => {})
  }

  function toggleStatus(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
    updateTask(id, { status: next[task.status] })
  }

  /** 带确认入口的状态切换 — 已完成任务激活为待办时需确认 */
  function requestToggleStatus(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    // 已完成 → 待办：弹出确认
    if (task.status === 'done') {
      reactivateConfirm.taskId = id
      reactivateConfirm.taskTitle = task.title
      reactivateConfirm.visible = true
      return
    }
    // 其他状态切换：直接执行
    toggleStatus(id)
  }

  function confirmReactivate() {
    if (reactivateConfirm.taskId) {
      if (reactivateConfirm.extraPatch) {
        // 有额外 patch（来自小时钟弹窗）：直接以指定状态+时间一起更新
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
    // 从回收站删除 + 在任务表新增
    const storage = getStorage()
    storage.upsertTask(task).catch(() => {})
    storage.deleteDeletedTaskById(id).catch(() => {})
    trash.value.splice(idx, 1)
    // Remove from tombstones since the task is being restored
    removeTombstones([id])
  }

  /** 从回收站永久删除 */
  function permanentDelete(id: string) {
    trash.value = trash.value.filter(t => t.id !== id)
    const storage = getStorage()
    // Delete the deleted_task record
    storage.deleteDeletedTaskById(id).catch(() => {})
    // Defensive: also ensure the task is removed from cleannote_tasks on Supabase
    // This handles the case where the original deleteTaskById failed silently
    storage.deleteTaskById(id).catch(() => {})
    // Record tombstone so this task can never be restored via sync
    addTombstones([id])
  }

  /** 清空回收站 */
  function emptyTrash() {
    const ids = trash.value.map(t => t.id)
    trash.value = []
    const storage = getStorage()
    for (const id of ids) {
      // Delete the deleted_task record
      storage.deleteDeletedTaskById(id).catch(() => {})
      // Defensive: also ensure the task is removed from cleannote_tasks on Supabase
      storage.deleteTaskById(id).catch(() => {})
    }
    // Record tombstones so these tasks can never be restored via sync
    addTombstones(ids)
  }

  /** 计算回收站中某任务剩余天数 */
  function getRemainingDays(deletedAt: string): number {
    const now = Date.now()
    const deletedTime = new Date(deletedAt).getTime()
    const expireMs = TRASH_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((expireMs - (now - deletedTime)) / (24 * 60 * 60 * 1000)))
  }

  // ---- 远程变更处理器（仅更新 reactive 状态 + local storage，不写 Supabase） ----

  /** 应用远端新增/更新的任务 */
  function applyRemoteTask(remote: Task) {
    // Don't restore permanently deleted (tombstoned) tasks
    const tombstones = getTombstones()
    if (tombstones.has(remote.id)) return
    const idx = tasks.value.findIndex(t => t.id === remote.id)
    if (idx === -1) {
      // 远端新增，本地不存在 → 加入列表
      tasks.value.push(remote)
    } else {
      // 两端都有 → 比较 updatedAt，远端更新则覆盖
      if (remote.updatedAt > tasks.value[idx].updatedAt) {
        tasks.value[idx] = remote
      }
    }
    // 只写 local storage
    localAdapter.saveTasks(tasks.value).catch(() => {})
  }

  /** 应用远端删除的任务（从主列表移除） */
  function applyRemoteTaskDelete(taskId: string) {
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx !== -1) {
      tasks.value.splice(idx, 1)
      localAdapter.saveTasks(tasks.value).catch(() => {})
    }
  }

  /** 应用远端新增/更新的回收站任务 */
  function applyRemoteDeletedTask(remote: DeletedTask) {
    // Don't restore permanently deleted (tombstoned) items to the trash display
    const tombstones = getTombstones()
    if (tombstones.has(remote.id)) return
    const idx = trash.value.findIndex(t => t.id === remote.id)
    if (idx === -1) {
      trash.value.unshift(remote)
    } else {
      if (remote.deletedAt > trash.value[idx].deletedAt) {
        trash.value[idx] = remote
      }
    }
    localAdapter.saveDeletedTasks(trash.value).catch(() => {})
  }

  /** 应用远端永久删除的回收站任务 */
  function applyRemoteDeletedTaskDelete(taskId: string) {
    const idx = trash.value.findIndex(t => t.id === taskId)
    if (idx !== -1) {
      trash.value.splice(idx, 1)
      localAdapter.saveDeletedTasks(trash.value).catch(() => {})
    }
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
    tasks, trash, loaded, reactivateConfirm,
    todoTasks, inProgressTasks, doneTasks, recentTasks, expiringTrash,
    load, reload, persist, persistTrash,
    addTask, updateTask, deleteTask, toggleStatus,
    requestToggleStatus, confirmReactivate, cancelReactivate,
    restoreTask, permanentDelete, emptyTrash, getRemainingDays, purgeExpired,
    applyRemoteTask, applyRemoteTaskDelete, applyRemoteDeletedTask, applyRemoteDeletedTaskDelete,
    getHeatmapData,
  }
})
