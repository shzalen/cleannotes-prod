/**
 * Todo Storage — 纯在线模式
 *
 * 读操作：直接从 Supabase 获取
 * 写操作：fire-and-forget 异步写入 Supabase
 */

import type { TodoItem } from '@/types'
import { supabaseGetTodos, supabaseUpsertTodo, supabaseDeleteTodoById } from './supabase'

let currentUserId = ''

// ---- Public API ----

export function setTodoUserId(userId: string) {
  currentUserId = userId
}

/** 从 Supabase 加载 */
export async function loadTodos(since?: string): Promise<TodoItem[]> {
  if (!currentUserId) return []
  return supabaseGetTodos(since)
}

/** 单条 upsert（fire-and-forget 云端写入） */
export function upsertTodo(todo: TodoItem): void {
  supabaseUpsertTodo(todo).catch(() => {})
}

/** 单条删除（fire-and-forget 云端写入） */
export function deleteTodoById(id: string): void {
  supabaseDeleteTodoById(id).catch(() => {})
}
