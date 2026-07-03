/**
 * Todo Storage — 离线优先（localStorage + Supabase 同步）
 *
 * 写操作：先写 localStorage（同步成功），再异步写 Supabase
 * 读操作：从 localStorage 读取
 * 同步：login 后从 Supabase 拉取云端数据合并到本地
 */

import type { TodoItem } from '@/types'
import { supabaseGetTodos, supabaseUpsertTodo, supabaseDeleteTodoById } from './supabase'

let currentUserId = ''

function prefix(): string {
  return currentUserId ? `cleannotes_${currentUserId}_todos` : `cleannotes_todos`
}

function readTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(prefix())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeTodos(todos: TodoItem[]): void {
  localStorage.setItem(prefix(), JSON.stringify(todos))
}

// ---- Public API ----

export function setTodoUserId(userId: string) {
  currentUserId = userId
}

/** 从 localStorage 加载 */
export function loadTodos(): TodoItem[] {
  return readTodos()
}

/** 全量保存到本地 */
export function saveTodos(todos: TodoItem[]): void {
  writeTodos(todos)
}

/** 单条 upsert（本地 + 后台云端） */
export function upsertTodo(todo: TodoItem): void {
  const todos = readTodos()
  const idx = todos.findIndex(t => t.id === todo.id)
  if (idx === -1) {
    todos.push(todo)
  } else {
    todos[idx] = todo
  }
  writeTodos(todos)

  // 后台异步同步到 Supabase
  supabaseUpsertTodo(todo).catch(() => {})
}

/** 单条删除（本地 + 后台云端） */
export function deleteTodoById(id: string): void {
  const todos = readTodos().filter(t => t.id !== id)
  writeTodos(todos)

  // 后台异步同步到 Supabase
  supabaseDeleteTodoById(id).catch(() => {})
}

/** 从 Supabase 拉取并合并到本地（login 时调用） */
export async function syncTodosFromCloud(): Promise<void> {
  try {
    const cloudData = await supabaseGetTodos()
    if (cloudData.length === 0) return

    const local = readTodos()
    const localMap = new Map(local.map(t => [t.id, t]))

    // 云端数据覆盖本地（updatedAt 更新者胜出）
    for (const cloud of cloudData) {
      const localItem = localMap.get(cloud.id)
      if (!localItem || cloud.updatedAt >= localItem.updatedAt) {
        localMap.set(cloud.id, cloud)
      }
    }

    writeTodos(Array.from(localMap.values()))
  } catch {
    // 静默失败，留待下次同步
  }
}
