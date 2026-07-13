import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WeeklyReport, WeeklyReportSummary, Task, TodoItem, XpEvent } from '@/types'
import {
  loadWeeklyReports,
  upsertWeeklyReport,
  deleteWeeklyReportById,
} from '@/services/weeklyReportStorage'
import { getXpEvents, getGrowthState } from '@/services/growthStorage'
import { toUTCISO, toLocalDate } from '@/utils/time'
import { useTaskStore, formatDuration } from './task'
import { useTodoStore } from './todo'
import { useAiStore } from './ai'
import { broadcastChange } from '@/services/crossTabSync'
import { buildChatUrl, escapeHtml, getISOWeekNumber } from '@/utils/ai'

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
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
  const [, sm, sd] = weekStart.split('-').map(Number)
  const [, em, ed] = weekEnd.split('-').map(Number)
  const weekNum = getISOWeekNumber(weekStart)
  return `第${weekNum}周 (${sm}/${sd} - ${em}/${ed})`
}

/** 获取周数（仅数字，ISO 8601） */
export function getWeekNumber(weekStart: string): number {
  return getISOWeekNumber(weekStart)
}

/** 判断日期/时间戳是否在指定周范围内 (P2-08: timezone-safe comparison) */
function isInWeek(dateStr: string | null, weekStart: string, weekEnd: string): boolean {
  if (!dateStr) return false
  // For ISO timestamps (length > 10), convert to local date for timezone-safe comparison
  const dateOnly = dateStr.length > 10 ? toLocalDate(new Date(dateStr)) : dateStr
  return dateOnly >= weekStart && dateOnly <= weekEnd
}

/** 生成周报摘要数据 */
function buildSummary(
  tasks: Task[],
  todos: TodoItem[],
  weekStart: string,
  weekEnd: string
): WeeklyReportSummary {
  // P2-08: Use isInWeek for timezone-safe date comparison
  const tasksCreated = tasks.filter(t => isInWeek(t.createdAt, weekStart, weekEnd)).length

  const tasksCompleted = tasks.filter(t =>
    t.status === 'done' && isInWeek(t.completedAt, weekStart, weekEnd)
  ).length

  const todosCreated = todos.filter(t => isInWeek(t.createdAt, weekStart, weekEnd)).length

  // XP 获得量：从 XP 事件中筛选本周的
  const xpEvents: XpEvent[] = getXpEvents()
  const totalXpGained = xpEvents
    .filter(e => isInWeek(e.createdAt, weekStart, weekEnd))
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

/** 生成编号段落 header — 测试报告风格（h2 + border-bottom） */
function sectionHeader(title: string): string {
  return `<h2 class="section-title">${title}</h2>`
}

/** 生成居中统计卡片（测试报告 summary-box 风格） */
function summaryBox(
  value: string,
  label: string,
  accentVar: string
): string {
  return `<div class="summary-box" style="--box-accent: ${accentVar};"><span class="sb-num" style="color: ${accentVar};">${value}</span><div class="sb-label">${label}</div></div>`
}

/** 生成周报 HTML 内容 */
function generateReportContent(
  weekStart: string,
  weekEnd: string,
  summary: WeeklyReportSummary,
  tasks: Task[],
  todos: TodoItem[],
  aiSummary?: string,
  aiSummaryStatus?: 'generating' | 'success' | 'failed' | null,
  aiSummaryError?: string
): string {
  // 本周完成的任务
  const completedTasks = tasks
    .filter(t =>
      t.status === 'done' && isInWeek(t.completedAt, weekStart, weekEnd)
    )
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  // 本周创建的待办
  const newTodos = todos
    .filter(t => isInWeek(t.createdAt, weekStart, weekEnd))

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

  // ---- 00 AI 智能总结（根据状态显示不同内容） ----
  if (aiSummaryStatus === 'generating') {
    parts.push(aiSummaryPlaceholder('generating'))
  } else if (aiSummaryStatus === 'failed') {
    parts.push(aiSummaryPlaceholder('failed', aiSummaryError))
  } else if (aiSummary) {
    parts.push(aiSummarySection(aiSummary))
  }

  // ---- 01 统计概览 ----
  parts.push('<div class="report-card">')
  parts.push(sectionHeader('统计概览'))
  parts.push('<div class="summary-grid">')

  const rateColor = summary.completionRate >= 80
    ? 'var(--color-success-text)'
    : summary.completionRate >= 50
      ? 'var(--color-warning-text)'
      : 'var(--color-danger-text)'

  parts.push(summaryBox(`${summary.completionRate}%`, '完成率', rateColor))
  parts.push(summaryBox(`${summary.tasksCompleted}`, '完成任务', 'var(--color-success-text)'))
  parts.push(summaryBox(`${summary.tasksCreated}`, '新增任务', 'var(--color-warning-text)'))
  parts.push(summaryBox(`${summary.totalXpGained}`, '经验获得', 'var(--color-accent-text)'))
  parts.push(summaryBox(`${summary.streakDays}`, '连续天数', 'var(--color-info-text)'))
  parts.push(summaryBox(`${summary.todosCreated}`, '新增待办', 'var(--color-text-2)'))

  parts.push('</div>')
  parts.push('</div>')

  // ---- 02 本周完成任务 ----
  parts.push('<div class="report-card">')
  parts.push(sectionHeader('本周完成任务'))

  if (completedTasks.length > 0) {
    parts.push('<table class="report-table">')
    parts.push('<thead><tr><th>任务名称</th><th style="text-align: center; width: 80px;">优先级</th><th style="text-align: center; width: 140px; white-space: nowrap;">实际开始时间</th><th style="text-align: center; width: 100px; white-space: nowrap;">耗时</th><th style="text-align: center; width: 140px; white-space: nowrap;">实际完成日期</th></tr></thead>')
    parts.push('<tbody>')
    for (const t of completedTasks) {
      const completedDate = t.completedAt ? formatReportDateTime(t.completedAt) : ''
      const startedAt = t.inProgressAt ? formatReportDateTime(t.inProgressAt) : '—'
      const duration = formatDuration(t) || '—'
      const pri = priorityConfig[t.priority] || priorityConfig.medium
      parts.push(`<tr><td class="task-name">${escapeHtml(t.title)}</td><td style="text-align: center;"><span class="pri-badge" style="color: ${pri.color}; background: ${pri.bg};">${pri.label}</span></td><td style="text-align: center; font-size: 12px; color: var(--color-text-3); white-space: nowrap;">${startedAt}</td><td style="text-align: center; font-size: 12px; color: var(--color-text-3); white-space: nowrap;">${duration}</td><td style="text-align: center; font-size: 12px; color: var(--color-text-3); white-space: nowrap;">${completedDate}</td></tr>`)
    }
    parts.push('</tbody></table>')
  } else {
    parts.push('<div class="section-empty">本周暂无完成任务</div>')
  }
  parts.push('</div>')

  // ---- 03 本周新增待办 ----
  parts.push('<div class="report-card">')
  parts.push(sectionHeader('本周新增待办'))

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
  parts.push('<div class="report-card">')
  parts.push(sectionHeader('待完成任务 · 下周跟进'))

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

/** 格式化 ISO 时间戳为本地 YYYY-MM-DD HH:MM */
function formatReportDateTime(iso: string): string {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${mins}`
}

/** AI 智能总结图标 SVG */
const AI_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14v2a4 4 0 0 1-8 0v-2"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/><circle cx="9" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none"/></svg>'

/** 调用 AI 生成周报总结（失败时静默返回 null，不影响周报生成） */
async function callAiForSummary(
  summary: WeeklyReportSummary,
  completedTasks: Task[],
  pendingTasks: Task[],
  newTodos: TodoItem[],
  weekStart: string,
  weekEnd: string
): Promise<{ summary: string | null; error?: string }> {
  const aiStore = useAiStore()

  // 确保 AI 配置已加载（防御性加载，避免因 App.vue 未初始化导致配置缺失）
  await aiStore.load()

  // 检查 AI 配置是否可用
  if (!aiStore.config.apiUrl || !aiStore.config.apiKey) {
    console.log('[WeeklyReport] AI config not available, skipping summary')
    return null
  }

  // 构建 prompt
  const promptLines: string[] = [
    `请为以下周报数据生成一段简洁的中文总结（100-200字），包含：工作成效评价、关键完成事项概括、下周重点提醒。语气客观专业，不使用markdown格式，只输出纯文本。`,
    '',
    `周报范围：${weekStart} 至 ${weekEnd}`,
    `完成率：${summary.completionRate}%`,
    `完成任务数：${summary.tasksCompleted}`,
    `新增任务数：${summary.tasksCreated}`,
    `新增待办数：${summary.todosCreated}`,
    `经验获得：${summary.totalXpGained} XP`,
    `连续天数：${summary.streakDays}`,
  ]

  if (completedTasks.length > 0) {
    promptLines.push('', '本周完成任务列表：')
    for (const t of completedTasks.slice(0, 15)) {
      const pri = t.priority === 'high' ? '高' : t.priority === 'low' ? '低' : '中'
      const dur = formatDuration(t) || '未知耗时'
      promptLines.push(`- ${t.title}（优先级${pri}，${dur}）`)
    }
  }

  if (pendingTasks.length > 0) {
    promptLines.push('', '下周待跟进任务：')
    for (const t of pendingTasks.slice(0, 10)) {
      const due = t.dueDate ? `截止${t.dueDate}` : '无截止日期'
      promptLines.push(`- ${t.title}（${due}）`)
    }
  }

  if (newTodos.length > 0) {
    promptLines.push('', '本周新增待办：')
    for (const t of newTodos.slice(0, 5)) {
      promptLines.push(`- ${t.title}`)
    }
  }

  // 构建 API URL (P2-10: 使用共享工具函数)
  const apiUrl = buildChatUrl(aiStore.config.apiUrl)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiStore.config.apiKey}`,
      },
      body: JSON.stringify({
        model: aiStore.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是清记App的周报分析助手。请根据提供的数据生成简洁的中文周报总结。' },
          { role: 'user', content: promptLines.join('\n') },
        ],
        stream: false,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const errMsg = `HTTP ${res.status}`
      console.warn(`[WeeklyReport] AI API returned ${errMsg}, skipping summary`)
      return { summary: null, error: errMsg }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      console.warn('[WeeklyReport] AI response has no content, skipping summary')
      return { summary: null, error: 'Empty AI response' }
    }

    return { summary: content.trim() }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.warn('[WeeklyReport] AI summary generation failed:', errMsg)
    return { summary: null, error: errMsg }
  }
}

/** 生成 AI 总结占位 section（generating / failed） */
function aiSummaryPlaceholder(status: 'generating' | 'failed', errorMsg?: string): string {
  if (status === 'generating') {
    return `<div class="report-card report-card-ai ai-status-generating">
  ${sectionHeader('AI 智能总结')}
  <div class="ai-summary-content">
    <div class="ai-badge">${AI_ICON}<span>AI</span></div>
    <div class="ai-placeholder ai-placeholder-generating">
      <div class="ai-shimmer-line"></div>
      <span class="ai-placeholder-text">AI 总结正在生成中，请稍后查看</span>
    </div>
  </div>
</div>`
  }
  // failed — include error details for diagnostics
  const errorSuffix = errorMsg ? `（${escapeHtml(errorMsg)}）` : ''
  return `<div class="report-card report-card-ai ai-status-failed">
  ${sectionHeader('AI 智能总结')}
  <div class="ai-summary-content">
    <div class="ai-badge">${AI_ICON}<span>AI</span></div>
    <div class="ai-placeholder ai-placeholder-failed">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-failed-icon"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span class="ai-placeholder-text">AI 总结暂不可用${errorSuffix}</span>
    </div>
  </div>
</div>`
}

/** 生成 AI 总结 section HTML（成功状态） */
function aiSummarySection(aiSummary: string): string {
  const paragraphs = aiSummary
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('')

  return `<div class="report-card report-card-ai ai-status-success">
  ${sectionHeader('AI 智能总结')}
  <div class="ai-summary-content">
    <div class="ai-badge">${AI_ICON}<span>AI</span></div>
    ${paragraphs}
  </div>
</div>`
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

  async function load(force = false) {
    if (loaded.value && !force) return

    // Full sync — always fetch all data.
    reports.value = await loadWeeklyReports()

    loaded.value = true
  }

  /** Phase 1: 立即生成报告基础内容（AI 占位为 generating） */
  async function generateReport(weekStart: string): Promise<WeeklyReport> {
    const weekEnd = getSunday(weekStart)

    const taskStore = useTaskStore()
    const todoStore = useTodoStore()

    if (!taskStore.loaded) await taskStore.load()
    if (!todoStore.loaded) await todoStore.load()

    const tasks = taskStore.tasks
    const todos = todoStore.todos

    const summary = buildSummary(tasks, todos, weekStart, weekEnd)

    // 先生成带 AI generating 占位的 HTML
    const content = generateReportContent(weekStart, weekEnd, summary, tasks, todos, undefined, 'generating')

    const now = toUTCISO()

    const existing = reports.value.find(r => r.weekStart === weekStart)
    const id = existing ? existing.id : genId()
    const createdAt = existing ? existing.createdAt : now

    const report: WeeklyReport = {
      id,
      weekStart,
      weekEnd,
      content,
      summary,
      aiSummaryStatus: 'generating',
      createdAt,
      updatedAt: now,
    }

    if (existing) {
      Object.assign(existing, report)
    } else {
      reports.value.push(report)
    }

    upsertWeeklyReport(report)
    broadcastChange('reports-updated')

    return report
  }

  /** Phase 2: 异步调用 AI 并更新报告内容 */
  async function generateAiSummary(weekStart: string): Promise<void> {
    const report = reports.value.find(r => r.weekStart === weekStart)
    if (!report) return

    // P1-03: Guard against concurrent generation
    if (report.aiSummaryStatus === 'generating') return

    const weekEnd = getSunday(weekStart)

    const taskStore = useTaskStore()
    const todoStore = useTodoStore()

    if (!taskStore.loaded) await taskStore.load()
    if (!todoStore.loaded) await todoStore.load()

    const tasks = taskStore.tasks
    const todos = todoStore.todos

    const completedTasks = tasks
      .filter(t =>
        t.status === 'done' && isInWeek(t.completedAt, weekStart, weekEnd)
      )
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

    const pendingTasks = tasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => {
        if (a.dueDate && !b.dueDate) return -1
        if (!a.dueDate && b.dueDate) return 1
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        return 0
      })

    const newTodos = todos
      .filter(t => isInWeek(t.createdAt, weekStart, weekEnd))

    // 调用 AI
    const result = await callAiForSummary(report.summary, completedTasks, pendingTasks, newTodos, weekStart, weekEnd)

    // 更新报告
    const status: 'success' | 'failed' = result.summary ? 'success' : 'failed'
    const newContent = generateReportContent(
      weekStart, weekEnd, report.summary, tasks, todos,
      result.summary ?? undefined, status, result.error
    )

    Object.assign(report, {
      content: newContent,
      aiSummary: result.summary || undefined,
      aiSummaryStatus: status,
      aiSummaryError: result.error || undefined,
      updatedAt: toUTCISO(),
    })

    upsertWeeklyReport(report)
    broadcastChange('reports-updated')
  }

  /** DEF-05: Retry AI summary generation for a failed report */
  async function retryAiSummary(weekStart: string): Promise<void> {
    const report = reports.value.find(r => r.weekStart === weekStart)
    if (!report || report.aiSummaryStatus !== 'failed') return

    // Reset to generating state so UI shows loading
    const generatingContent = generateReportContent(
      weekStart, getSunday(weekStart), report.summary,
      [], [], undefined, 'generating'
    )
    Object.assign(report, {
      content: generatingContent,
      aiSummaryStatus: 'generating' as const,
      aiSummaryError: undefined,
      updatedAt: toUTCISO(),
    })
    upsertWeeklyReport(report)

    return generateAiSummary(weekStart)
  }

  /** 删除报告 */
  function deleteReport(id: string) {
    const idx = reports.value.findIndex(r => r.id === id)
    if (idx === -1) return
    reports.value.splice(idx, 1)
    deleteWeeklyReportById(id)
    broadcastChange('reports-updated')
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
    generateAiSummary,
    retryAiSummary,
    deleteReport,
    getReportByWeek,
    hasCurrentWeekReport,
  }
})
