export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  email: string
  nickname: string
  createdAt: string
  lastLoginAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  /** HH:mm 格式的计划开始时间，null 表示未安排 */
  startTime: string | null
  /** YYYY-MM-DD 格式的计划开始日期，null 表示未设置 */
  startDate: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** 实际进入"进行中"状态的时间戳，用于计算执行耗时 */
  inProgressAt: string | null
}

export interface DeletedTask extends Task {
  deletedAt: string // ISO timestamp — 删除时间
}

export interface TimerConfig {
  workStart: string
  workEnd: string
  workDays: number[]
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  /** Pending tool call that requires user confirmation */
  pendingAction?: AiPendingAction
}

export interface AiPendingAction {
  toolCallId: string
  toolName: string
  args: Record<string, any>
  /** Human-readable description of what will happen */
  description: string
  /** Whether user has confirmed/rejected, null = pending */
  confirmed: boolean | null
}

export interface AiConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export type HeatmapView = 'year' | 'month' | 'week'

export interface HeatmapCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

// ---- Growth System (烛 · Candle) ----

export type DailyState = 'vitality' | 'withered' | 'recovery'

export interface GrowthState {
  level: number
  xp: number
  totalXp: number
  streakDays: number
  maxStreakDays: number
  dailyState: DailyState
  witheredDays: number
  lastActiveDate: string
  lastXpGainAt: string
}

// ---- Todo (待办事项) ----

// ---- Memo (备忘录) ----

export interface MemoItem {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  /** 页面图标（emoji） */
  icon: string
  /** 同组内排序权重，越小越靠前 */
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TodoItem {
  id: string
  title: string
  description: string
  /** YYYY-MM-DD 格式的预计开始日期，转任务时映射为 startDate */
  estimatedStart: string | null
  /** YYYY-MM-DD 格式的预计结束日期，转任务时映射为 dueDate */
  estimatedEnd: string | null
  /** 转任务后关联的任务 ID */
  linkedTaskId: string | null
  /** 重要等级 1-5，0 表示未评级 */
  importance: number
  createdAt: string
  updatedAt: string
}

export type AchievementCategory = 'milestone' | 'streak' | 'special' | 'hidden'

export interface AchievementDef {
  id: string
  name: string
  description: string
  category: AchievementCategory
  condition: string
  isHidden: boolean
}

export interface AchievementRecord {
  id: string
  unlockedAt: string
}

export type XpSource = 'complete' | 'priority' | 'night' | 'deadline' | 'streak' | 'achievement'

export interface XpEvent {
  id: string
  taskId?: string
  source: XpSource
  xp: number
  createdAt: string
}

// ---- Weekly Report (周报) ----

export interface WeeklyReportSummary {
  tasksCreated: number
  tasksCompleted: number
  todosCreated: number
  totalXpGained: number
  completionRate: number
  streakDays: number
}

export interface WeeklyReport {
  id: string
  weekStart: string       // 周一日期 YYYY-MM-DD
  weekEnd: string         // 周日日期 YYYY-MM-DD
  content: string         // HTML 富文本内容
  summary: WeeklyReportSummary
  aiSummary?: string      // AI 智能总结（可选，AI不可用时为空）
  aiSummaryStatus?: 'generating' | 'success' | 'failed'  // AI 总结生成状态
  aiSummaryError?: string  // DEF-05: Error message when AI summary fails
  createdAt: string       // 生成时间
  updatedAt: string
}
