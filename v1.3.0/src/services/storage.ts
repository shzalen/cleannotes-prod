import type { Task, DeletedTask, TimerConfig, AiMessage, AiConfig } from '@/types'
import { hybridAdapter } from './hybrid'
import { setGrowthUserId } from './growthStorage'
import { setTodoUserId } from './todoStorage'
import { setMemoUserId } from './memoStorage'
import { setWeeklyReportUserId } from './weeklyReportStorage'

export { isOnline, syncStatus } from './hybrid'

export interface StorageAdapter {
  setUserId(userId: string): void

  // ---- Tasks ----
  getTasks(): Promise<Task[]>
  /** 全量保存（仅用于初始同步/合并场景，日常 CRUD 用 upsertTask/deleteTaskById） */
  saveTasks(tasks: Task[]): Promise<void>
  /** 单条 upsert：新增或更新，以 id 为主键 */
  upsertTask(task: Task): Promise<void>
  /** 单条删除 */
  deleteTaskById(id: string): Promise<void>

  // ---- Deleted Tasks (回收站) ----
  getDeletedTasks(): Promise<DeletedTask[]>
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
  /** 删除该用户所有 AI 消息 */
  deleteAllAiMessages(): Promise<void>

  // ---- AI Config ----
  getAiConfig(): Promise<AiConfig | null>
  saveAiConfig(config: AiConfig): Promise<void>
}

let currentAdapter: StorageAdapter = hybridAdapter

export function getStorage(): StorageAdapter {
  return currentAdapter
}

export function setStorage(adapter: StorageAdapter) {
  currentAdapter = adapter
}

/** 切换用户后调用：更新适配器的 userId，清除脏数据 */
export function switchUser(userId: string) {
  currentAdapter.setUserId(userId)
  setGrowthUserId(userId)
  setTodoUserId(userId)
  setMemoUserId(userId)
  setWeeklyReportUserId(userId)
}
