import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig } from '@/types'
import { supabaseAdapter } from './supabase'
import { setGrowthUserId } from './growthStorage'
import { setTodoUserId } from './todoStorage'
import { setMemoUserId } from './memoStorage'
import { setWeeklyReportUserId } from './weeklyReportStorage'
import { ref } from 'vue'

// ---- Reactive state (stubs — pure online mode, no offline sync) ----

export const isOnline = ref(true)
export const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')

export interface SyncLogEntry {
  id: number
  time: string
  status: 'success' | 'error' | 'idle'
  message: string
}

export const syncLogs = ref<SyncLogEntry[]>([])

export interface StorageAdapter {
  setUserId(userId: string): void

  // ---- Tasks ----
  getTasks(since?: string): Promise<Task[]>
  saveTasks(tasks: Task[]): Promise<void>
  upsertTask(task: Task): Promise<void>
  deleteTaskById(id: string): Promise<void>

  // ---- Deleted Tasks (回收站) ----
  getDeletedTasks(since?: string): Promise<DeletedTask[]>
  saveDeletedTasks(tasks: DeletedTask[]): Promise<void>
  upsertDeletedTask(task: DeletedTask): Promise<void>
  deleteDeletedTaskById(id: string): Promise<void>

  // ---- Timer Config ----
  getTimerConfig(): Promise<TimerConfig | null>
  saveTimerConfig(config: TimerConfig): Promise<void>

  // ---- AI Messages ----
  getAiMessages(): Promise<AiMessage[]>
  saveAiMessages(messages: AiMessage[]): Promise<void>
  upsertAiMessage(msg: AiMessage): Promise<void>
  deleteAiMessageById(id: string): Promise<void>
  deleteAllAiMessages(): Promise<void>

  // ---- AI Config ----
  getAiConfig(): Promise<AiConfig | null>
  saveAiConfig(config: AiConfig): Promise<void>
}

let currentAdapter: StorageAdapter = supabaseAdapter

export function getStorage(): StorageAdapter {
  return currentAdapter
}

export function setStorage(adapter: StorageAdapter) {
  currentAdapter = adapter
}

/** 切换用户后调用：更新适配器的 userId */
export function switchUser(userId: string) {
  currentAdapter.setUserId(userId)
  setGrowthUserId(userId)
  setTodoUserId(userId)
  setMemoUserId(userId)
  setWeeklyReportUserId(userId)
}
