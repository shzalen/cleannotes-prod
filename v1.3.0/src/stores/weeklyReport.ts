import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WeeklyReport, WeeklyReportSummary, Task, TodoItem, XpEvent } from '@/types'
import {
  loadWeeklyReports,
  upsertWeeklyReport,
  deleteWeeklyReportById,
  syncWeeklyReportsFromCloud,
} from '@/services/weeklyReportStorage'
import { getXpEvents, getGrowthState } from '@/services/growthStorage'
import { toUTCISO, toLocalDate } from '@/utils/time'
import { useTaskStore } from './task'
import { useTodoStore } from './todo'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 获取指定日期所在周的周一（YYYY-MM-DD） */
export function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Sunday = 0, move to Monday
  d.setDate(d.getDate() + diff)
  return toLocalDate(d)
}

/** 获取本周一 */
export function getCurrentWeekMonday(): string {
  return getMonday(new Date())
}

/** 获取指定周一对应的周日 */
export function getSunday(mondayStr: string): string {
  const monday = new Date(mondayStr + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return toLocalDate(sunday)
}

/** 获取周的显示标签 */
export function getWeekLabel(weekStart: string): string {
  const weekEnd = getSunday(weekStart)
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const [ey, em, ed] = weekEnd.split('-').map(Number)

  // 计算第几周
  const startOfYear = new Date(sy, 0, 1)
  const weekMonday = new Date(weekStart + 'T00:00:00')
  const weekNum = Math.ceil(
    ((weekMonday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )

  return `第${weekNum}周 (${sm}/${sd} - ${em}/${ed})`
}

/** 获取周数（仅数字） */
export function getWeekNumber(weekStart: string): number {
  const [sy] = weekStart.split('-').map(Number)
  const startOfYear = new Date(sy, 0, 1)
  const weekMonday = new Date(weekStart + 'T00:00:00')
  return Math.ceil(
    ((weekMonday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
}

/** 判断日期是否在指定周范围内 */
function isInWeek(dateStr: string | null, weekStart: string, weekEnd: string): boolean {
  if (!dateStr) return false
  return dateStr >= weekStart && dateStr <= weekEnd
}

/** 生成周报摘要数据 */
function buildSummary(
  tasks: Task[],
  todos: TodoItem[],
  weekStart: string,
  weekEnd: string
): WeeklyReportSummary {
  const tasksCreated = tasks.filter(t =>
    t.createdAt >= weekStart + 'T00:00:00' && t.createdAt <= weekEnd + 'T23:59:59'
  ).length

  const tasksCompleted = tasks.filter(t =>
    t.status === 'done' && t.completedAt &&
    t.completedAt >= weekStart + 'T00:00:00' &&
    t.completedAt <= weekEnd + 'T23:59:59'
  ).length

  const todosCreated = todos.filter(t =>
    t.createdAt >= weekStart + 'T00:00:00' && t.createdAt <= weekEnd + 'T23:59:59'
  ).length

  // XP 获得量：从 XP 事件中筛选本周的
  const xpEvents: XpEvent[] = getXpEvents()
  const totalXpGained = xpEvents
    .filter(e =>
      e.createdAt >= weekStart + 'T00:00:00' &&
      e.createdAt <= weekEnd + 'T23:59:59'
    )
    .reduce((sum, e) => sum + e.xp, 0)

  // 完成率：本周完成任务数 / max(本周新增任务数, 本周完成任务数)
  // 用 max 做分母，既反映当周任务完成情况，又避免清理历史 backlog 时出现 >100% 的异常值
  const denominator = Math.max(tasksCreated, tasksCompleted)
  const completionRate = denominator > 0
    ? Math.round((tasksCompleted / denominator) * 100)
    : 0

  // 连续天数
  const growthState = getGrowthState()
  const streakDays = growthState.streakDays

  return {
    tasksCreated,
    tasksCompleted,
    todosCreated,
    totalXpGained,
    completionRate,
    streakDays,
  }
}

/** 优先级配置 */
const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: 'var(--color-danger-text)', bg: 'var(--color-danger-light)' },
  medium: { label: '中', color: 'var(--color-warning-text)', bg: 'var(--color-warning-light)' },
  low: { label: '低', color: 'var(--color-success-text)', bg: 'var(--color-success-light)' },
}

/** SVG 图标定义 */
const ICONS = {
  completion: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  completed: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  created: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  xp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  streak: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  todo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
}

/** 生成编号段落 header */
function sectionHeader(num: string, title: string): string {
  return `<div class="section-header"><span class="section-num">${num}</span><span class="section-title-text">${title}</span><span class="section-line"></span></div>`
}

/** 生成单个统计卡片 */
function statCard(
  icon: string,
  value: string,
  label: string,
  accentVar: string,
  bgVar: string
): string {
  return `<div class="stat-card" style="--card-accent: ${accentVar}; --card-bg: ${bgVar};"><div class="sc-icon">${icon}</div><div class="sc-body"><div class="sc-value" style="color: ${accentVar};">${value}</div><div class="sc-label">${label}</div></div></div>`
}

/** 生成周报 HTML 内容 */
function generateReportContent(
  weekStart: string,
  weekEnd: string,
  summary: WeeklyReportSummary,
  tasks: Task[],
  todos: TodoItem[]
): string {
  // 本周完成的任务
  const completedTasks = tasks
    .filter(t =>
      t.status === 'done' && t.completedAt &&
      t.completedAt >= weekStart + 'T00:00:00' &&
      t.completedAt <= weekEnd + 'T23:59:59'
    )
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  // 本周创建的待办
  const newTodos = todos
    .filter(t =>
      t.createdAt >= weekStart + 'T00:00:00' &&
      t.createdAt <= weekEnd + 'T23:59:59'
    )

  // 未完成的任务（下周待办）
  const pendingTasks = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      return 0
    })

  const parts: string[] = []

  // ---- 01 统计概览 ----
  parts.push('<div class="report-section">')
  parts.push(sectionHeader('01', '统计概览'))
  parts.push('<div class="stat-grid">')

  const rateColor = summary.completionRate >= 80
    ? 'var(--color-success-text)'
    : summary.completionRate >= 50
      ? 'var(--color-warning-text)'
      : 'var(--color-danger-text)'
  const rateBg = summary.completionRate >= 80
    ? 'var(--color-success-light)'
    : summary.completionRate >= 50
      ? 'var(--color-warning-light)'
      : 'var(--color-danger-light)'

  parts.push(statCard(ICONS.completion, `${summary.completionRate}%`, '完成率', rateColor, rateBg))
  parts.push(statCard(ICONS.completed, `${summary.tasksCompleted}`, '完成任务', 'var(--color-success-text)', 'var(--color-success-light)'))
  parts.push(statCard(ICONS.created, `${summary.tasksCreated}`, '新增任务', 'var(--color-warning-text)', 'var(--color-warning-light)'))
  parts.push(statCard(ICONS.xp, `${summary.totalXpGained}`, '经验获得', 'var(--color-accent-text)', 'var(--color-accent-light)'))
  parts.push(statCard(ICONS.streak, `${summary.streakDays}`, '连续天数', 'var(--color-info-text)', 'var(--color-info-light)'))
  parts.push(statCard(ICONS.todo, `${summary.todosCreated}`, '新增待办', 'var(--color-text-2)', 'var(--color-bg-3)'))

  parts.push('</div>')
  parts.push('</div>')

  // ---- 02 本周完成任务 ----
  parts.push('<div class="report-section">')
  parts.push(sectionHeader('02', '本周完成任务'))

  if (completedTasks.length > 0) {
    parts.push('<table class="task-table">')
    parts.push('<thead><tr><th>任务名称</th><th style="text-align: center; width: 80px;">优先级</th><th style="text-align: center; width: 120px;">完成日期</th></tr></thead>')
    parts.push('<tbody>')
    for (const t of completedTasks) {
      const completedDate = t.completedAt ? t.completedAt.slice(0, 10) : ''
      const pri = priorityConfig[t.priority] || priorityConfig.medium
      parts.push(`<tr><td class="task-name">${escapeHtml(t.title)}</td><td style="text-align: center;"><span class="pri-badge" style="color: ${pri.color}; background: ${pri.bg};">${pri.label}</span></td><td style="text-align: center; font-size: 12px; color: var(--color-text-3);">${completedDate}</td></tr>`)
    }
    parts.push('</tbody></table>')
  } else {
    parts.push('<div class="section-empty">本周暂无完成任务</div>')
  }
  parts.push('</div>')

  // ---- 03 本周新增待办 ----
  parts.push('<div class="report-section">')
  parts.push(sectionHeader('03', '本周新增待办'))

  if (newTodos.length > 0) {
    parts.push('<ul class="todo-list">')
    for (const t of newTodos) {
      const desc = t.description ? `<span class="todo-desc">${escapeHtml(t.description.slice(0, 80))}</span>` : ''
      parts.push(`<li><span class="todo-dot"></span><div class="todo-content"><span class="todo-title">${escapeHtml(t.title)}</span>${desc}</div></li>`)
    }
    parts.push('</ul>')
  } else {
    parts.push('<div class="section-empty">本周无新增待办</div>')
  }
  parts.push('</div>')

  // ---- 04 待完成任务 · 下周跟进 ----
  parts.push('<div class="report-section">')
  parts.push(sectionHeader('04', '待完成任务 · 下周跟进'))

  if (pendingTasks.length > 0) {
    parts.push('<ul class="pending-list">')
    for (const t of pendingTasks) {
      const pri = priorityConfig[t.priority] || priorityConfig.medium
      const dueStr = t.dueDate ? `<span class="pending-due">${t.dueDate}</span>` : '<span class="pending-due" style="opacity: 0.4;">无截止日期</span>'
      parts.push(`<li><span class="pending-pri" style="background: ${pri.color};"></span><span class="pending-title">${escapeHtml(t.title)}</span>${dueStr}</li>`)
    }
    parts.push('</ul>')
  } else {
    parts.push('<div class="section-empty">所有任务均已完成</div>')
  }
  parts.push('</div>')

  return parts.join('\n')
}

/** HTML 转义，防止用户输入的标题中包含特殊字符 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const useWeeklyReportStore = defineStore('weeklyReport', () => {
  const reports = ref<WeeklyReport[]>([])
  const loaded = ref(false)

  // 排序后的报告列表（按周降序）
  const sortedReports = computed(() =>
    [...reports.value].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  )

  /** 获取本周一日期 */
  const currentWeekMonday = computed(() => getCurrentWeekMonday())

  /** 检索特定周的报告 */
  function getReportByWeek(weekStart: string): WeeklyReport | undefined {
    return reports.value.find(r => r.weekStart === weekStart)
  }

  function load() {
    if (loaded.value) return
    reports.value = loadWeeklyReports()
    loaded.value = true
    // 后台从云端同步
    syncWeeklyReportsFromCloud().then(() => {
      reports.value = loadWeeklyReports()
    }).catch(() => {})
  }

  /** 生成指定周的报告 */
  function generateReport(weekStart: string): WeeklyReport {
    const weekEnd = getSunday(weekStart)

    // 访问 taskStore 和 todoStore 获取数据
    const taskStore = useTaskStore()
    const todoStore = useTodoStore()

    // 确保 store 已加载
    if (!taskStore.loaded) taskStore.load()
    if (!todoStore.loaded) todoStore.load()

    const tasks = taskStore.tasks
    const todos = todoStore.todos

    const summary = buildSummary(tasks, todos, weekStart, weekEnd)
    const content = generateReportContent(weekStart, weekEnd, summary, tasks, todos)

    const now = toUTCISO()

    // 检查是否已有该周报告，有则更新
    const existing = reports.value.find(r => r.weekStart === weekStart)
    const id = existing ? existing.id : genId()
    const createdAt = existing ? existing.createdAt : now

    const report: WeeklyReport = {
      id,
      weekStart,
      weekEnd,
      content,
      summary,
      createdAt,
      updatedAt: now,
    }

    // 更新本地列表
    if (existing) {
      Object.assign(existing, report)
    } else {
      reports.value.push(report)
    }

    // 持久化
    upsertWeeklyReport(report)

    return report
  }

  /** 删除报告 */
  function deleteReport(id: string) {
    const idx = reports.value.findIndex(r => r.id === id)
    if (idx === -1) return
    reports.value.splice(idx, 1)
    deleteWeeklyReportById(id)
  }

  /** 检查本周是否已生成报告 */
  const hasCurrentWeekReport = computed(() =>
    reports.value.some(r => r.weekStart === getCurrentWeekMonday())
  )

  return {
    reports,
    loaded,
    sortedReports,
    currentWeekMonday,
    load,
    generateReport,
    deleteReport,
    getReportByWeek,
    hasCurrentWeekReport,
  }
})
