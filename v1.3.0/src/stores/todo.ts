import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TodoItem } from '@/types'
import { loadTodos, upsertTodo, deleteTodoById } from '@/services/todoStorage'
import { toUTCISO } from '@/utils/time'
import { broadcastChange } from '@/services/crossTabSync'

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---- P0-02: Debounced todo writes with retry (mirrors task.ts pattern) ----
const TODO_DEBOUNCE_MS = 300
const pendingTodoWrites = new Map<string, { todo: TodoItem; op: 'upsert' | 'delete' }>()
let todoWriteTimer: ReturnType<typeof setTimeout> | null = null
const TODO_MAX_RETRIES = 3
const TODO_RETRY_BASE_MS = 1000

function scheduleTodoWrite(todo: TodoItem, op: 'upsert' | 'delete' = 'upsert') {
  pendingTodoWrites.set(todo.id, { todo, op })
  if (todoWriteTimer) clearTimeout(todoWriteTimer)
  todoWriteTimer = setTimeout(flushTodoWrites, TODO_DEBOUNCE_MS)
}

function scheduleTodoRetry(todo: TodoItem, op: 'upsert' | 'delete', retries: number) {
  const delay = TODO_RETRY_BASE_MS * Math.pow(2, retries)
  setTimeout(() => {
    if (op === 'delete') {
      deleteTodoById(todo.id).then(() => {}).catch(() => {
        if (retries + 1 < TODO_MAX_RETRIES) scheduleTodoRetry(todo, op, retries + 1)
        else console.error(`[TodoStore] Failed to delete todo after ${TODO_MAX_RETRIES} retries: ${todo.id}`)
      })
    } else {
      upsertTodo(todo).then(() => {}).catch(() => {
        if (retries + 1 < TODO_MAX_RETRIES) scheduleTodoRetry(todo, op, retries + 1)
        else console.error(`[TodoStore] Failed to write todo after ${TODO_MAX_RETRIES} retries: ${todo.id}`)
      })
    }
  }, delay)
}

/** Flush pending todo writes immediately (e.g., before logout) */
export function flushTodoWrites() {
  if (todoWriteTimer) {
    clearTimeout(todoWriteTimer)
    todoWriteTimer = null
  }
  if (pendingTodoWrites.size === 0) return
  for (const { todo, op } of pendingTodoWrites.values()) {
    if (op === 'delete') {
      deleteTodoById(todo.id).catch(() => scheduleTodoRetry(todo, op, 0))
    } else {
      upsertTodo(todo).catch(() => scheduleTodoRetry(todo, op, 0))
    }
  }
  pendingTodoWrites.clear()
}

// Flush on page hide
function onTodoVisibilityChange() {
  if (document.hidden) flushTodoWrites()
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onTodoVisibilityChange)
}

/** R4-P02: Remove module-level listener (call on logout) */
export function cleanupTodoListeners() {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onTodoVisibilityChange)
  }
}

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<TodoItem[]>([])
  const loaded = ref(false)

  /** 仅显示未转任务的待办事项，按 importance 降序，同等级中有日期的排前面 */
  const activeTodos = computed(() => {
    const active = todos.value.filter(t => !t.linkedTaskId)
    return active.sort((a, b) => {
      const iDiff = (b.importance ?? 0) - (a.importance ?? 0)
      if (iDiff !== 0) return iDiff
      const aHasDate = !!(a.estimatedStart || a.estimatedEnd)
      const bHasDate = !!(b.estimatedStart || b.estimatedEnd)
      if (aHasDate && !bHasDate) return -1
      if (!aHasDate && bHasDate) return 1
      return 0
    })
  })

  async function load(force = false) {
    if (loaded.value && !force) return

    // Full sync — always fetch all data.
    todos.value = await loadTodos()

    loaded.value = true
  }

  function addTodo(data: {
    title: string
    description?: string
    estimatedStart?: string | null
    estimatedEnd?: string | null
    importance?: number
  }): TodoItem {
    const now = toUTCISO()
    const todo: TodoItem = {
      id: genId(),
      title: data.title,
      description: data.description || '',
      estimatedStart: data.estimatedStart ?? null,
      estimatedEnd: data.estimatedEnd ?? null,
      linkedTaskId: null,
      importance: data.importance ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    todos.value.push(todo)
    scheduleTodoWrite(todo)
    broadcastChange('todos-updated')
    return todo
  }

  function updateTodo(id: string, patch: Partial<Pick<TodoItem, 'title' | 'description' | 'estimatedStart' | 'estimatedEnd' | 'importance'>>) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    Object.assign(todos.value[idx], patch, { updatedAt: toUTCISO() })
    scheduleTodoWrite(todos.value[idx])
    broadcastChange('todos-updated')
  }

  function removeTodo(id: string) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = todos.value[idx]
    scheduleTodoWrite(removed, 'delete')
    todos.value = todos.value.filter(t => t.id !== id)
    broadcastChange('todos-updated')
  }

  /** 标记待办已转任务（设置 linkedTaskId），从活跃列表隐藏 */
  function markConverted(id: string, taskId: string) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    todos.value[idx].linkedTaskId = taskId
    todos.value[idx].updatedAt = toUTCISO()
    scheduleTodoWrite(todos.value[idx])
    broadcastChange('todos-updated')
  }

  function getTodoById(id: string): TodoItem | undefined {
    return todos.value.find(t => t.id === id)
  }

  return {
    todos,
    loaded,
    activeTodos,
    load,
    addTodo,
    updateTodo,
    removeTodo,
    markConverted,
    getTodoById,
  }
})
