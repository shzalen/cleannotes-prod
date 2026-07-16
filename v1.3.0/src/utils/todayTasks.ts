/**
 * 今日任务共享逻辑 — 从 PC 端 TodayProgress.vue 抽取，供 PC/移动端复用，避免逻辑漂移。
 *
 * 过滤规则（isTodayTask）与排序规则（sortTasks）与 PC 首页完全一致。
 */
import type { Task } from '@/types'
import { toLocalDate } from './time'

/**
 * 判断任务是否属于"今日任务"。
 * @param t 任务
 * @param todayStr 今日本地日期字符串 YYYY-MM-DD（由 toLocalDate 生成）
 */
export function isTodayTask(t: Task, todayStr: string): boolean {
  // 1. 开始日期为当天 → 计划任务
  if (t.startDate === todayStr) return true
  // 2. 开始日期早于当天且未完成 → 延迟任务
  if (t.startDate && t.startDate < todayStr && t.status !== 'done') return true
  // 3. 无开始日期（旧数据/未规划）→ 回退到 createdAt 逻辑
  if (!t.startDate) {
    const createdOnDay = t.createdAt.startsWith(todayStr)
    const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr && t.status !== 'done'
    const completedOnDay = !!t.completedAt && t.completedAt.startsWith(todayStr)
    return createdOnDay || createdBeforeAndUndone || completedOnDay
  }
  // 4. 今天完成的任务（无论开始日期是什么，方便追溯）
  if (t.completedAt && t.completedAt.startsWith(todayStr)) return true
  return false
}

/** 过滤出今日任务列表 */
export function filterTodayTasks(tasks: Task[], todayStr: string): Task[] {
  return tasks.filter((t) => isTodayTask(t, todayStr))
}

/**
 * 统一排序（与 PC 端 sortedTasks 一致）：
 * 1. 未完成 → startDate 升序（有开始日期优先），再按 startTime 升序；
 *    无开始日期的任务排在后面，按 createdAt 降序（最新创建的在前）
 * 2. 已完成 → completedAt 降序，统一排在最后
 */
export function sortTasks(tasks: Task[]): Task[] {
  const active: Task[] = []
  const done: Task[] = []
  for (const t of tasks) {
    if (t.status === 'done') done.push(t)
    else active.push(t)
  }

  active.sort((a, b) => {
    if (a.startDate && b.startDate) {
      const dateCmp = a.startDate.localeCompare(b.startDate)
      if (dateCmp !== 0) return dateCmp
      const aTime = a.startTime || '00:00'
      const bTime = b.startTime || '00:00'
      return aTime.localeCompare(bTime)
    }
    if (a.startDate && !b.startDate) return -1
    if (!a.startDate && b.startDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })

  done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  return [...active, ...done]
}

/** 按指定日期（YYYY-MM-DD）过滤任务，与 PC 端 TaskRightPanel dayTasks 逻辑一致 */
export function filterTasksByDate(tasks: Task[], dateStr: string): Task[] {
  const today = toLocalDate()
  const isToday = dateStr === today

  return tasks.filter((t) => {
    // 1. 开始日期为选中日期
    if (t.startDate === dateStr) return true
    // 2. 开始日期早于选中日期且未完成（延迟/逾期任务）—— 仅今日视图显示
    if (isToday && t.startDate && t.startDate < dateStr && t.status !== 'done') return true
    // 3. 无开始日期（旧数据）→ 回退到 createdAt 逻辑
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(dateStr)
      if (isToday) {
        const createdBeforeAndUndone = t.createdAt.slice(0, 10) < dateStr && t.status !== 'done'
        const completedOnDay = !!t.completedAt && t.completedAt.startsWith(dateStr)
        return createdOnDay || createdBeforeAndUndone || completedOnDay
      }
      return createdOnDay
    }
    // 4. 选中日期完成的任务（无论开始日期是什么，方便追溯）
    if (t.completedAt && t.completedAt.startsWith(dateStr)) return true
    return false
  })
}
