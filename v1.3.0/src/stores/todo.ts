import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TodoItem } from '@/types'
import { loadTodos, upsertTodo, deleteTodoById } from '@/services/todoStorage'
import { toUTCISO } from '@/utils/time'
import { broadcastChange } from '@/services/crossTabSync'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
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
    upsertTodo(todo)
    broadcastChange('todos-updated')
    return todo
  }

  function updateTodo(id: string, patch: Partial<Pick<TodoItem, 'title' | 'description' | 'estimatedStart' | 'estimatedEnd' | 'importance'>>) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    Object.assign(todos.value[idx], patch, { updatedAt: toUTCISO() })
    upsertTodo(todos.value[idx])
    broadcastChange('todos-updated')
  }

  function removeTodo(id: string) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    deleteTodoById(id)
    todos.value = todos.value.filter(t => t.id !== id)
    broadcastChange('todos-updated')
  }

  /** 标记待办已转任务（设置 linkedTaskId），从活跃列表隐藏 */
  function markConverted(id: string, taskId: string) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx === -1) return
    todos.value[idx].linkedTaskId = taskId
    todos.value[idx].updatedAt = toUTCISO()
    upsertTodo(todos.value[idx])
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
