/**
 * H5 移动端数据层 — 直连 Supabase，无本地缓存
 * 每次 CRUD 都直接请求云端
 */
import { ref } from 'vue'
import type { Task, TodoItem, TaskStatus, TaskPriority } from '@/types'
import { supabaseAdapter, supabaseGetTodos, supabaseUpsertTodo, supabaseDeleteTodoById } from '@/services/supabase'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useH5Data() {
  const loading = ref(false)
  const error = ref('')

  // ==================== Tasks ====================

  async function fetchTasks(): Promise<Task[]> {
    loading.value = true
    error.value = ''
    try {
      return await supabaseAdapter.getTasks()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
      return []
    } finally {
      loading.value = false
    }
  }

  async function saveTask(task: Task): Promise<void> {
    await supabaseAdapter.upsertTask(task)
  }

  async function removeTask(id: string): Promise<void> {
    await supabaseAdapter.deleteTaskById(id)
  }

  async function toggleTaskStatus(task: Task): Promise<Task> {
    const now = new Date().toISOString()
    let newStatus: TaskStatus
    let patch: Partial<Task> = {}

    if (task.status === 'todo') {
      newStatus = 'in_progress'
      patch = { status: newStatus, inProgressAt: now }
    } else if (task.status === 'in_progress') {
      newStatus = 'done'
      patch = { status: newStatus, completedAt: now }
    } else {
      newStatus = 'todo'
      patch = { status: newStatus, inProgressAt: null, completedAt: null }
    }

    const updated: Task = {
      ...task,
      ...patch,
      updatedAt: now,
    } as Task
    await saveTask(updated)
    return updated
  }

  async function createTask(data: {
    title: string
    description?: string
    priority?: TaskPriority
    startDate?: string | null
    startTime?: string | null
    dueDate?: string | null
    tags?: string[]
  }): Promise<Task> {
    const now = new Date().toISOString()
    const task: Task = {
      id: genId(),
      title: data.title,
      description: data.description || '',
      status: 'todo',
      priority: data.priority || 'medium',
      startDate: data.startDate || null,
      startTime: data.startTime || null,
      dueDate: data.dueDate || null,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      inProgressAt: null,
    }
    await saveTask(task)
    return task
  }

  async function updateTaskFields(
    task: Task,
    patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'startDate' | 'startTime' | 'dueDate' | 'tags' | 'inProgressAt' | 'completedAt'>>,
  ): Promise<Task> {
    const updated: Task = {
      ...task,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    await saveTask(updated)
    return updated
  }

  // ==================== Todos ====================

  async function fetchTodos(): Promise<TodoItem[]> {
    loading.value = true
    error.value = ''
    try {
      return await supabaseGetTodos()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
      return []
    } finally {
      loading.value = false
    }
  }

  async function createTodo(data: {
    title: string
    description?: string
    estimatedStart?: string | null
    estimatedEnd?: string | null
    importance?: number
  }): Promise<TodoItem> {
    const now = new Date().toISOString()
    const todo: TodoItem = {
      id: genId(),
      title: data.title,
      description: data.description || '',
      estimatedStart: data.estimatedStart || null,
      estimatedEnd: data.estimatedEnd || null,
      linkedTaskId: null,
      importance: data.importance ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    await supabaseUpsertTodo(todo)
    return todo
  }

  async function removeTodo(id: string): Promise<void> {
    await supabaseDeleteTodoById(id)
  }

  /** 将待办转为任务 */
  async function convertTodoToTask(todo: TodoItem): Promise<Task> {
    const task = await createTask({
      title: todo.title,
      description: todo.description,
      startDate: todo.estimatedStart,
      dueDate: todo.estimatedEnd,
      priority: todo.importance >= 4 ? 'high' : todo.importance >= 2 ? 'medium' : 'low',
    })

    // 标记 todo 为已转换
    const updated: TodoItem = {
      ...todo,
      linkedTaskId: task.id,
      updatedAt: new Date().toISOString(),
    }
    await supabaseUpsertTodo(updated)

    return task
  }

  return {
    loading,
    error,
    // Tasks
    fetchTasks,
    saveTask,
    removeTask,
    toggleTaskStatus,
    createTask,
    updateTaskFields,
    // Todos
    fetchTodos,
    createTodo,
    removeTodo,
    convertTodoToTask,
  }
}
