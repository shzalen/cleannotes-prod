import type { StorageAdapter } from './storage'
import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig, TodoItem, MemoItem, WeeklyReport, GrowthState, XpEvent, AchievementRecord } from '@/types'
import { normalizeTimestamp } from '@/utils/time'

export const SUPABASE_URL = 'https://ghkyhbxltdxhkhpqltdr.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoa3loYnhsdGR4aGtocHFsdGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDY1MTUsImV4cCI6MjA4NDA4MjUxNX0.vTtJRyPO_Q61QB6bTAv8X90ih-wMg9KlDuhXGKXy0FA'

function buildHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    // x-user-id header for RLS policy
    ...(currentUserId ? { 'x-user-id': currentUserId } : {}),
  }
}

// ---- Current user context ----

let currentUserId = ''

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
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags as string[]) ?? [],
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
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags as string[]) ?? [],
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
    workDays: typeof r.work_days === 'string' ? JSON.parse(r.work_days) : (r.work_days as number[]),
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
    throw new Error(`Supabase ${res.status}: ${text}`)
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

  async getTasks(): Promise<Task[]> {
    const rows = (await request('cleannote_tasks', 'GET', {
      query: `?user_id=eq.${currentUserId}&order=created_at.asc`,
    })) as Record<string, unknown>[]
    return rows.map(rowToTask)
  },

  /** 全量保存：批量 upsert（不再 DELETE ALL + INSERT ALL） */
  async saveTasks(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) {
      // 仍需清空云端数据（用户可能删除了所有任务）
      await request('cleannote_tasks', 'DELETE', {
        query: `?user_id=eq.${currentUserId}`,
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

  /** 单条删除 */
  async deleteTaskById(id: string): Promise<void> {
    await request('cleannote_tasks', 'DELETE', {
      query: `?id=eq.${id}`,
      prefer: 'return=minimal',
    })
  },

  // ========== Deleted Tasks ==========

  async getDeletedTasks(): Promise<DeletedTask[]> {
    const rows = (await request('cleannote_deleted_tasks', 'GET', {
      query: `?user_id=eq.${currentUserId}&order=deleted_at.desc`,
    })) as Record<string, unknown>[]
    return rows.map(rowToDeletedTask)
  },

  async saveDeletedTasks(tasks: DeletedTask[]): Promise<void> {
    if (tasks.length === 0) {
      await request('cleannote_deleted_tasks', 'DELETE', {
        query: `?user_id=eq.${currentUserId}`,
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
      query: `?id=eq.${id}`,
      prefer: 'return=minimal',
    })
  },

  // ========== Timer Config ==========

  async getTimerConfig(): Promise<TimerConfig | null> {
    const rows = (await request('cleannote_timer_config', 'GET', {
      query: `?user_id=eq.${currentUserId}`,
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
      query: `?user_id=eq.${currentUserId}&order=timestamp.asc`,
    })) as Record<string, unknown>[]
    return rows.map(rowToAiMsg)
  },

  async saveAiMessages(messages: AiMessage[]): Promise<void> {
    if (messages.length === 0) {
      await request('cleannote_ai_messages', 'DELETE', {
        query: `?user_id=eq.${currentUserId}`,
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
      query: `?id=eq.${id}`,
      prefer: 'return=minimal',
    })
  },

  async deleteAllAiMessages(): Promise<void> {
    await request('cleannote_ai_messages', 'DELETE', {
      query: `?user_id=eq.${currentUserId}`,
      prefer: 'return=minimal',
    })
  },

  // ========== AI Config ==========

  async getAiConfig(): Promise<AiConfig | null> {
    const rows = (await request('cleannote_ai_config', 'GET', {
      query: `?user_id=eq.${currentUserId}`,
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

export async function supabaseGetTodos(): Promise<TodoItem[]> {
  if (!currentUserId) return []
  const rows = (await request('cleannote_todos', 'GET', {
    query: `?user_id=eq.${currentUserId}&order=created_at.asc`,
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
    query: `?id=eq.${id}`,
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
    query: `?user_id=eq.${currentUserId}`,
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
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags as string[]) ?? [],
    pinned: (r.pinned as boolean) ?? false,
    icon: (r.icon as string) || '',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

// ---- Memo CRUD ----

export async function supabaseGetMemos(): Promise<MemoItem[]> {
  if (!currentUserId) return []
  const rows = (await request('cleannote_memos', 'GET', {
    query: `?user_id=eq.${currentUserId}&order=created_at.desc`,
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

export async function supabaseDeleteMemoById(id: string): Promise<void> {
  if (!currentUserId) return
  await request('cleannote_memos', 'DELETE', {
    query: `?id=eq.${id}`,
    prefer: 'return=minimal',
  })
}

// ================================================================
// Attachment Storage (Supabase Storage bucket: cleannote_attachments)
// ================================================================

const ATTACHMENTS_BUCKET = 'cleannote_attachments'

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (e.g. "memo/abc123-image.png").
 */
export async function supabaseUploadAttachment(file: File): Promise<string> {
  if (!currentUserId) throw new Error('Not authenticated')

  // Build a unique path: memo/{userId}/{timestamp}-{originalName}
  const ts = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `memo/${currentUserId}/${ts}-${safeName}`

  const url = `${SUPABASE_URL}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'x-user-id': currentUserId,
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
    throw new Error(`Supabase Storage upload failed (${res.status}): ${text}`)
  }

  return path
}

/**
 * Get the public URL for a stored attachment.
 */
export function supabaseGetPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${ATTACHMENTS_BUCKET}/${path}`
}

/**
 * Delete an attachment from Supabase Storage.
 */
export async function supabaseDeleteAttachment(path: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'x-user-id': currentUserId,
  }

  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.error(`Supabase Storage delete failed (${res.status}): ${text}`)
  }
}

// ================================================================
// Weekly Report (cleannote_weekly_reports)
// ================================================================

function weeklyReportToRow(r: WeeklyReport) {
  return {
    id: r.id,
    user_id: currentUserId,
    week_start: r.weekStart,
    week_end: r.weekEnd,
    content: r.content,
    summary: r.summary,
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
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export async function supabaseGetWeeklyReports(): Promise<WeeklyReport[]> {
  if (!currentUserId) return []
  const rows = (await request('cleannote_weekly_reports', 'GET', {
    query: `?user_id=eq.${currentUserId}&order=week_start.desc`,
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
    query: `?id=eq.${id}`,
    prefer: 'return=minimal',
  })
}
