import type { StorageAdapter } from './storage'
import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig, TodoItem, MemoItem, WeeklyReport, GrowthState, XpEvent, AchievementRecord } from '@/types'
import { normalizeTimestamp } from '@/utils/time'
import { SUPABASE_URL, SUPABASE_KEY, getCachedAccessToken } from './supabaseClient'

// Re-export for backward compatibility (hybrid.ts etc.)
export { SUPABASE_URL, SUPABASE_KEY }

function buildHeaders(): Record<string, string> {
  const token = getCachedAccessToken()
  return {
    apikey: SUPABASE_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ---- Current user context ----

let currentUserId = ''

// S-12: Safe URL-encoded user ID for PostgREST query params
function uidParam(): string {
  return encodeURIComponent(currentUserId)
}

// S-17: Safe JSON parse with fallback for malformed data
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ---- camelCase ↔ snake_case helpers ----

function taskToRow(t: Task) {
  return {
    id: t.id,
    user_id: currentUserId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.dueDate,
    start_date: t.startDate,
    start_time: t.startTime,
    tags: t.tags,
    // TIMESTAMPTZ fields: must be UTC ISO (with Z suffix) for correct PG storage
    created_at: normalizeTimestamp(t.createdAt),
    updated_at: normalizeTimestamp(t.updatedAt),
    completed_at: normalizeTimestamp(t.completedAt),
    in_progress_at: normalizeTimestamp(t.inProgressAt),
  }
}

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? '',
    status: r.status as Task['status'],
    priority: r.priority as Task['priority'],
    dueDate: (r.due_date as string) ?? null,
    startDate: (r.start_date as string) ?? null,
    startTime: (r.start_time as string) ?? null,
    // S-17: Safe JSON parse with fallback
    tags: safeJsonParse(r.tags, []),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    completedAt: (r.completed_at as string) ?? null,
    inProgressAt: (r.in_progress_at as string) ?? null,
  }
}

function deletedTaskToRow(t: DeletedTask) {
  return {
    id: t.id,
    user_id: currentUserId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.dueDate,
    start_date: t.startDate,
    start_time: t.startTime,
    tags: t.tags,
    // TIMESTAMPTZ fields: must be UTC ISO (with Z suffix) for correct PG storage
    created_at: normalizeTimestamp(t.createdAt),
    updated_at: normalizeTimestamp(t.updatedAt),
    completed_at: normalizeTimestamp(t.completedAt),
    in_progress_at: normalizeTimestamp(t.inProgressAt),
    deleted_at: normalizeTimestamp(t.deletedAt),
  }
}

function rowToDeletedTask(r: Record<string, unknown>): DeletedTask {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? '',
    status: r.status as Task['status'],
    priority: r.priority as Task['priority'],
    dueDate: (r.due_date as string) ?? null,
    startDate: (r.start_date as string) ?? null,
    startTime: (r.start_time as string) ?? null,
    tags: safeJsonParse(r.tags, []),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    completedAt: (r.completed_at as string) ?? null,
    inProgressAt: (r.in_progress_at as string) ?? null,
    deletedAt: r.deleted_at as string,
  }
}

function timerConfigToRow(c: TimerConfig) {
  return {
    id: 1,
    user_id: currentUserId,
    work_start: c.workStart,
    work_end: c.workEnd,
    work_days: JSON.stringify(c.workDays),
  }
}

function rowToTimerConfig(r: Record<string, unknown>): TimerConfig {
  return {
    workStart: r.work_start as string,
    workEnd: r.work_end as string,
    workDays: safeJsonParse(r.work_days, [1, 2, 3, 4, 5]),
  }
}

function aiMsgToRow(m: AiMessage) {
  return {
    id: m.id,
    user_id: currentUserId,
    role: m.role,
    content: m.content,
    timestamp: normalizeTimestamp(m.timestamp),
  }
}

function rowToAiMsg(r: Record<string, unknown>): AiMessage {
  return {
    id: r.id as string,
    role: r.role as AiMessage['role'],
    content: r.content as string,
    timestamp: r.timestamp as string,
  }
}

function aiConfigToRow(c: AiConfig) {
  return {
    id: 1,
    user_id: currentUserId,
    api_url: c.apiUrl,
    api_key: c.apiKey,
    model: c.model,
  }
}

function rowToAiConfig(r: Record<string, unknown>): AiConfig {
  return {
    apiUrl: (r.api_url as string) ?? '',
    apiKey: (r.api_key as string) ?? '',
    model: (r.model as string) ?? '',
  }
}

// ---- Low-level request helper ----

async function request(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  options?: {
    body?: unknown
    query?: string            // e.g. "?id=eq.1"
    prefer?: string           // e.g. "return=representation", "resolution=merge-duplicates"
  }
): Promise<unknown> {
  const url = `${SUPABASE_URL}/rest/v1/${table}${options?.query ? options.query : ''}`
  const h: Record<string, string> = buildHeaders()
  if (options?.prefer) h['Prefer'] = options.prefer

  const res = await fetch(url, {
    method,
    headers: h,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    // S-13: Sanitize error message — truncate and strip potential sensitive data
    const sanitized = text.slice(0, 200).replace(/[<>"']/g, '')
    throw new Error(`Supabase ${res.status}: ${sanitized}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---- Adapter ----

export const supabaseAdapter: StorageAdapter = {

  setUserId(userId: string) {
    currentUserId = userId
  },

  // ========== Tasks ==========

  async getTasks(since?: string): Promise<Task[]> {
    let query = `?user_id=eq.${uidParam()}&order=created_at.asc`
    if (since) {
      query += `&updated_at=gt.${encodeURIComponent(since)}`
    }
    const rows = (await request('cleannote_tasks', 'GET', {
      query,
    })) as Record<string, unknown>[]
    return rows.map(rowToTask)
  },

  /** 全量保存：批量 upsert（不再 DELETE ALL + INSERT ALL） */
  async saveTasks(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) {
      // 仍需清空云端数据（用户可能删除了所有任务）
      await request('cleannote_tasks', 'DELETE', {
        query: `?user_id=eq.${uidParam()}`,
        prefer: 'return=minimal',
      })
      return
    }
    const rows = tasks.map(taskToRow)
    await request('cleannote_tasks', 'POST', {
      body: rows,
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  /** 单条 upsert */
  async upsertTask(task: Task): Promise<void> {
    await request('cleannote_tasks', 'POST', {
      body: taskToRow(task),
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  /** 单条删除 — S-18: include user_id in DELETE condition for defense in depth */
  async deleteTaskById(id: string): Promise<void> {
    await request('cleannote_tasks', 'DELETE', {
      query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  /** P-07: Batch delete tasks by IDs — single request instead of N requests */
  async deleteTasksByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const idList = ids.map(id => encodeURIComponent(id)).join(',')
    await request('cleannote_tasks', 'DELETE', {
      query: `?id=in.(${idList})&user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  // ========== Deleted Tasks ==========

  async getDeletedTasks(since?: string): Promise<DeletedTask[]> {
    let query = `?user_id=eq.${uidParam()}&order=deleted_at.desc`
    if (since) {
      query += `&updated_at=gt.${encodeURIComponent(since)}`
    }
    const rows = (await request('cleannote_deleted_tasks', 'GET', {
      query,
    })) as Record<string, unknown>[]
    return rows.map(rowToDeletedTask)
  },

  async saveDeletedTasks(tasks: DeletedTask[]): Promise<void> {
    if (tasks.length === 0) {
      await request('cleannote_deleted_tasks', 'DELETE', {
        query: `?user_id=eq.${uidParam()}`,
        prefer: 'return=minimal',
      })
      return
    }
    const rows = tasks.map(deletedTaskToRow)
    await request('cleannote_deleted_tasks', 'POST', {
      body: rows,
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  async upsertDeletedTask(task: DeletedTask): Promise<void> {
    await request('cleannote_deleted_tasks', 'POST', {
      body: deletedTaskToRow(task),
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  async deleteDeletedTaskById(id: string): Promise<void> {
    await request('cleannote_deleted_tasks', 'DELETE', {
      query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  /** P-07: Batch delete deleted-tasks by IDs — single request instead of N requests */
  async deleteDeletedTasksByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const idList = ids.map(id => encodeURIComponent(id)).join(',')
    await request('cleannote_deleted_tasks', 'DELETE', {
      query: `?id=in.(${idList})&user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  // ========== Timer Config ==========

  async getTimerConfig(): Promise<TimerConfig | null> {
    const rows = (await request('cleannote_timer_config', 'GET', {
      query: `?user_id=eq.${uidParam()}`,
    })) as Record<string, unknown>[]
    return rows.length > 0 ? rowToTimerConfig(rows[0]) : null
  },

  async saveTimerConfig(config: TimerConfig): Promise<void> {
    await request('cleannote_timer_config', 'POST', {
      body: timerConfigToRow(config),
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  // ========== AI Messages ==========

  async getAiMessages(): Promise<AiMessage[]> {
    const rows = (await request('cleannote_ai_messages', 'GET', {
      query: `?user_id=eq.${uidParam()}&order=timestamp.asc`,
    })) as Record<string, unknown>[]
    return rows.map(rowToAiMsg)
  },

  async saveAiMessages(messages: AiMessage[]): Promise<void> {
    if (messages.length === 0) {
      await request('cleannote_ai_messages', 'DELETE', {
        query: `?user_id=eq.${uidParam()}`,
        prefer: 'return=minimal',
      })
      return
    }
    const rows = messages.map(aiMsgToRow)
    await request('cleannote_ai_messages', 'POST', {
      body: rows,
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  async upsertAiMessage(msg: AiMessage): Promise<void> {
    await request('cleannote_ai_messages', 'POST', {
      body: aiMsgToRow(msg),
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },

  async deleteAiMessageById(id: string): Promise<void> {
    await request('cleannote_ai_messages', 'DELETE', {
      query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  async deleteAllAiMessages(): Promise<void> {
    await request('cleannote_ai_messages', 'DELETE', {
      query: `?user_id=eq.${uidParam()}`,
      prefer: 'return=minimal',
    })
  },

  // ========== AI Config ==========

  async getAiConfig(): Promise<AiConfig | null> {
    const rows = (await request('cleannote_ai_config', 'GET', {
      query: `?user_id=eq.${uidParam()}`,
    })) as Record<string, unknown>[]
    return rows.length > 0 ? rowToAiConfig(rows[0]) : null
  },

  async saveAiConfig(config: AiConfig): Promise<void> {
    await request('cleannote_ai_config', 'POST', {
      body: aiConfigToRow(config),
      prefer: 'return=minimal,resolution=merge-duplicates',
    })
  },
}

// ================================================================
// Todo & Growth Supabase CRUD（独立于 StorageAdapter，由 todoStorage / growthStorage 调用）
// ================================================================

// ---- camelCase ↔ snake_case for Todo ----

function todoToRow(t: TodoItem) {
  return {
    id: t.id,
    user_id: currentUserId,
    title: t.title,
    description: t.description,
    estimated_start: t.estimatedStart,
    estimated_end: t.estimatedEnd,
    linked_task_id: t.linkedTaskId,
    importance: t.importance,
    created_at: normalizeTimestamp(t.createdAt),
    updated_at: normalizeTimestamp(t.updatedAt),
  }
}

function rowToTodo(r: Record<string, unknown>): TodoItem {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? '',
    estimatedStart: (r.estimated_start as string) ?? null,
    estimatedEnd: (r.estimated_end as string) ?? null,
    linkedTaskId: (r.linked_task_id as string) ?? null,
    importance: (r.importance as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

// ---- Todo CRUD ----

export async function supabaseGetTodos(since?: string): Promise<TodoItem[]> {
  if (!currentUserId) return []
  let query = `?user_id=eq.${uidParam()}&order=created_at.asc`
  if (since) {
    query += `&updated_at=gt.${encodeURIComponent(since)}`
  }
  const rows = (await request('cleannote_todos', 'GET', {
    query,
  })) as Record<string, unknown>[]
  return rows.map(rowToTodo)
}

export async function supabaseUpsertTodo(todo: TodoItem): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_todos', 'POST', {
    body: todoToRow(todo),
    prefer: 'return=minimal,resolution=merge-duplicates',
  })
}

export async function supabaseDeleteTodoById(id: string): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_todos', 'DELETE', {
    query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
    prefer: 'return=minimal',
  })
}

// ---- Growth data row format ----

interface GrowthRow {
  user_id: string
  state_json: GrowthState
  xp_events_json: XpEvent[]
  achievements_json: AchievementRecord[]
  updated_at: string
}

function growthToRow(
  state: GrowthState,
  xpEvents: XpEvent[],
  achievements: AchievementRecord[],
): GrowthRow {
  return {
    user_id: currentUserId,
    state_json: state,
    xp_events_json: xpEvents,
    achievements_json: achievements,
    updated_at: new Date().toISOString(),
  }
}

// ---- Growth CRUD ----

export interface GrowthCloudData {
  state: GrowthState
  xpEvents: XpEvent[]
  achievements: AchievementRecord[]
}

export async function supabaseGetGrowth(): Promise<GrowthCloudData | null> {
  if (!currentUserId) return null
  const rows = (await request('cleannote_growth', 'GET', {
    query: `?user_id=eq.${uidParam()}`,
  })) as Record<string, unknown>[]
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    state: r.state_json as GrowthState,
    xpEvents: (r.xp_events_json as XpEvent[]) ?? [],
    achievements: (r.achievements_json as AchievementRecord[]) ?? [],
  }
}

export async function supabaseUpsertGrowth(
  state: GrowthState,
  xpEvents: XpEvent[],
  achievements: AchievementRecord[],
): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_growth', 'POST', {
    body: growthToRow(state, xpEvents, achievements),
    prefer: 'return=minimal,resolution=merge-duplicates',
  })
}

// ================================================================
// Memo CRUD
// ================================================================

// ---- camelCase ↔ snake_case for Memo ----

function memoToRow(m: MemoItem) {
  return {
    id: m.id,
    user_id: currentUserId,
    title: m.title,
    content: m.content,
    tags: m.tags,
    pinned: m.pinned,
    icon: m.icon,
    sort_order: m.sortOrder,
    created_at: normalizeTimestamp(m.createdAt),
    updated_at: normalizeTimestamp(m.updatedAt),
  }
}

function rowToMemo(r: Record<string, unknown>): MemoItem {
  return {
    id: r.id as string,
    title: r.title as string,
    content: (r.content as string) ?? '',
    tags: safeJsonParse(r.tags, []),
    pinned: (r.pinned as boolean) ?? false,
    icon: (r.icon as string) || '',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

// ---- Memo CRUD ----

export async function supabaseGetMemos(since?: string): Promise<MemoItem[]> {
  if (!currentUserId) return []
  let query = `?user_id=eq.${uidParam()}&order=created_at.desc`
  if (since) {
    query += `&updated_at=gt.${encodeURIComponent(since)}`
  }
  const rows = (await request('cleannote_memos', 'GET', {
    query,
  })) as Record<string, unknown>[]
  return rows.map(rowToMemo)
}

export async function supabaseUpsertMemo(memo: MemoItem): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_memos', 'POST', {
    body: memoToRow(memo),
    prefer: 'return=minimal,resolution=merge-duplicates',
  })
}

/**
 * Partial update via PATCH — sends only metadata fields (title, tags, pinned, icon,
 * sort_order, updated_at), skipping the potentially large `content` field.
 * Use when content hasn't changed to avoid re-uploading megabytes of base64 images.
 */
export async function supabasePatchMemo(id: string, memo: MemoItem): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_memos', 'PATCH', {
    query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
    body: {
      title: memo.title,
      tags: memo.tags,
      pinned: memo.pinned,
      icon: memo.icon,
      sort_order: memo.sortOrder,
      updated_at: normalizeTimestamp(memo.updatedAt),
    },
    prefer: 'return=minimal',
  })
}

export async function supabaseDeleteMemoById(id: string): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_memos', 'DELETE', {
    query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
    prefer: 'return=minimal',
  })
}

// ================================================================
// Attachment Storage (Supabase Storage bucket: cleannote_attachments)
// ================================================================
// Security note (S2.3): The bucket is public for read access.
// This is an accepted trade-off for a free-tier personal note app because:
//   1. File paths contain a random UUID (122 bits entropy) — practically unguessable
//   2. The app is for personal use, not public content sharing
//   3. Signed URL migration would require complex content transformation
//      (image URLs are embedded in memo HTML, and signed URLs expire)
// To further harden: paths use crypto.randomUUID() instead of predictable timestamps.

const ATTACHMENTS_BUCKET = 'cleannote_attachments'

/**
 * Generate a random ID for file path entropy.
 * Uses crypto.randomUUID() when available, falls back to timestamp + random.
 */
function generatePathId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (e.g. "memo/{userId}/{uuid}-{filename}").
 */
export async function supabaseUploadAttachment(file: File): Promise<string> {
  if (!currentUserId) throw new Error('Not authenticated')

  // Build a unique, unguessable path: memo/{userId}/{randomUUID}-{originalName}
  const pathId = generatePathId()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `memo/${currentUserId}/${pathId}-${safeName}`

  const url = `${SUPABASE_URL}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`
  const token = getCachedAccessToken()
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_KEY}`,
  }
  // Let fetch set Content-Type from the FormData boundary
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase Storage upload failed (${res.status}): ${text.slice(0, 200).replace(/[<>"']/g, '')}`)
  }

  return path
}

/**
 * Get the public URL for a stored attachment.
 * Note: The bucket is public-read; URLs contain random UUIDs for entropy.
 */
export function supabaseGetPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${ATTACHMENTS_BUCKET}/${path}`
}

/**
 * Create a signed URL for a stored attachment (for future private-bucket migration).
 * Signed URLs expire after the specified duration (default: 1 hour).
 * Requires the user to be authenticated.
 */
export async function supabaseCreateSignedUrl(
  path: string,
  expiresIn: number = 3600,
): Promise<string> {
  const token = getCachedAccessToken()
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${ATTACHMENTS_BUCKET}/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase signed URL failed (${res.status}): ${text.slice(0, 200).replace(/[<>"']/g, '')}`)
  }
  const data = await res.json()
  return data.signedURL?.startsWith('http')
    ? data.signedURL
    : `${SUPABASE_URL}${data.signedURL}`
}

/**
 * Delete an attachment from Supabase Storage.
 */
export async function supabaseDeleteAttachment(path: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`
  const token = getCachedAccessToken()
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_KEY}`,
  }

  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.error(`Supabase Storage delete failed (${res.status}): ${text.slice(0, 200).replace(/[<>"']/g, '')}`)
  }
}

// ================================================================
// Weekly Report (cleannote_weekly_reports)
// ================================================================

function weeklyReportToRow(r: WeeklyReport) {  return {
    id: r.id,
    user_id: currentUserId,
    week_start: r.weekStart,
    week_end: r.weekEnd,
    content: r.content,
    summary: r.summary,
    ai_summary: r.aiSummary || null,
    ai_summary_status: r.aiSummaryStatus || null,
    created_at: normalizeTimestamp(r.createdAt),
    updated_at: normalizeTimestamp(r.updatedAt),
  }
}

function rowToWeeklyReport(r: Record<string, unknown>): WeeklyReport {
  return {
    id: r.id as string,
    weekStart: (r.week_start as string) ?? '',
    weekEnd: (r.week_end as string) ?? '',
    content: (r.content as string) ?? '',
    summary: (r.summary as WeeklyReport['summary']) ?? { tasksCreated: 0, tasksCompleted: 0, todosCreated: 0, totalXpGained: 0, completionRate: 0, streakDays: 0 },
    aiSummary: (r.ai_summary as string) || undefined,
    aiSummaryStatus: (r.ai_summary_status as 'generating' | 'success' | 'failed') || undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export async function supabaseGetWeeklyReports(since?: string): Promise<WeeklyReport[]> {
  if (!currentUserId) return []
  let query = `?user_id=eq.${uidParam()}&order=week_start.desc`
  if (since) {
    query += `&updated_at=gt.${encodeURIComponent(since)}`
  }
  const rows = (await request('cleannote_weekly_reports', 'GET', {
    query,
  })) as Record<string, unknown>[]
  return rows.map(rowToWeeklyReport)
}

export async function supabaseUpsertWeeklyReport(report: WeeklyReport): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_weekly_reports', 'POST', {
    body: weeklyReportToRow(report),
    prefer: 'return=minimal,resolution=merge-duplicates',
  })
}

export async function supabaseDeleteWeeklyReportById(id: string): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_weekly_reports', 'DELETE', {
    query: `?id=eq.${encodeURIComponent(id)}&user_id=eq.${uidParam()}`,
    prefer: 'return=minimal',
  })
}

// ================================================================
// Server-side XP Verification (S6.1)
// ================================================================

export interface XpVerificationResult {
  totalXp: number
  breakdown: { source: string; xp: number }[]
  error?: string
}

/**
 * Call the server-side XP verification RPC.
 * Validates that the task is actually completed and calculates XP
 * using the same formula as the client, but on the server.
 *
 * Returns null if the RPC is unavailable (graceful degradation).
 */
export async function supabaseVerifyXp(taskId: string): Promise<XpVerificationResult | null> {
  const token = getCachedAccessToken()
  if (!token) return null

  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/cleannote_calculate_xp`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_task_id: taskId }),
    })

    if (!res.ok) return null

    const data = await res.json()
    if (data.error) {
      console.warn('[XP Verification] Server returned error:', data.error)
      return null
    }

    return {
      totalXp: data.totalXp ?? 0,
      breakdown: (data.breakdown ?? []).map((b: any) => ({
        source: b.source,
        xp: b.xp,
      })),
    }
  } catch {
    // RPC not deployed or network error — fall back to client-side calculation
    return null
  }
}
