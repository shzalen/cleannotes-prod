import type { StorageAdapter } from './storage'
import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig } from '@/types'

let currentUserId = ''

function prefix(key: string): string {
  return currentUserId ? `cleannotes_${currentUserId}_${key}` : `cleannotes_${key}`
}

const BASE_KEYS = {
  tasks: 'tasks',
  deletedTasks: 'deleted_tasks',
  timerConfig: 'timer_config',
  aiMessages: 'ai_messages',
  aiConfig: 'ai_config',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export const localAdapter: StorageAdapter = {

  setUserId(userId: string) {
    currentUserId = userId
  },

  // ========== Tasks ==========

  async getTasks() {
    return read<Task[]>(prefix(BASE_KEYS.tasks), [])
  },

  async saveTasks(tasks: Task[]) {
    write(prefix(BASE_KEYS.tasks), tasks)
  },

  async upsertTask(task: Task) {
    const key = prefix(BASE_KEYS.tasks)
    const tasks = read<Task[]>(key, [])
    const idx = tasks.findIndex(t => t.id === task.id)
    if (idx === -1) {
      tasks.push(task)
    } else {
      tasks[idx] = task
    }
    write(key, tasks)
  },

  async deleteTaskById(id: string) {
    const key = prefix(BASE_KEYS.tasks)
    const tasks = read<Task[]>(key, [])
    write(key, tasks.filter(t => t.id !== id))
  },

  // ========== Deleted Tasks ==========

  async getDeletedTasks() {
    return read<DeletedTask[]>(prefix(BASE_KEYS.deletedTasks), [])
  },

  async saveDeletedTasks(tasks: DeletedTask[]) {
    write(prefix(BASE_KEYS.deletedTasks), tasks)
  },

  async upsertDeletedTask(task: DeletedTask) {
    const key = prefix(BASE_KEYS.deletedTasks)
    const tasks = read<DeletedTask[]>(key, [])
    const idx = tasks.findIndex(t => t.id === task.id)
    if (idx === -1) {
      tasks.unshift(task)
    } else {
      tasks[idx] = task
    }
    write(key, tasks)
  },

  async deleteDeletedTaskById(id: string) {
    const key = prefix(BASE_KEYS.deletedTasks)
    const tasks = read<DeletedTask[]>(key, [])
    write(key, tasks.filter(t => t.id !== id))
  },

  // ========== Timer Config ==========

  async getTimerConfig() {
    return read<TimerConfig | null>(prefix(BASE_KEYS.timerConfig), null)
  },

  async saveTimerConfig(config: TimerConfig) {
    write(prefix(BASE_KEYS.timerConfig), config)
  },

  // ========== AI Messages ==========

  async getAiMessages() {
    return read<AiMessage[]>(prefix(BASE_KEYS.aiMessages), [])
  },

  async saveAiMessages(messages: AiMessage[]) {
    write(prefix(BASE_KEYS.aiMessages), messages)
  },

  async upsertAiMessage(msg: AiMessage) {
    const key = prefix(BASE_KEYS.aiMessages)
    const messages = read<AiMessage[]>(key, [])
    const idx = messages.findIndex(m => m.id === msg.id)
    if (idx === -1) {
      messages.push(msg)
    } else {
      messages[idx] = msg
    }
    write(key, messages)
  },

  async deleteAiMessageById(id: string) {
    const key = prefix(BASE_KEYS.aiMessages)
    const messages = read<AiMessage[]>(key, [])
    write(key, messages.filter(m => m.id !== id))
  },

  async deleteAllAiMessages() {
    write(prefix(BASE_KEYS.aiMessages), [])
  },

  // ========== AI Config ==========

  async getAiConfig() {
    return read<AiConfig | null>(prefix(BASE_KEYS.aiConfig), null)
  },

  async saveAiConfig(config: AiConfig) {
    write(prefix(BASE_KEYS.aiConfig), config)
  },
}
