<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskDetailModal from '@/components/TaskDetailModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useTaskStore, formatDuration } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'

type ViewMode = 'all' | 'day' | 'week' | 'month' | 'quarter' | 'year'

const props = defineProps<{
  tasks: Task[]
  selectedDate: string // YYYY-MM-DD
  statusFilter?: TaskStatus | 'all'
}>()
const emit = defineEmits<{
  toggleStatus: [id: string]
  'update:statusFilter': [value: TaskStatus | 'all']
}>()

const activeFilter = computed(() => props.statusFilter ?? 'all')

const statusOptions: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const store = useTaskStore()
const { isDark, isZuru, isTencent } = useTheme()
const router = useRouter()

function analyzeTask(taskId: string) {
  router.push(`/ai?taskId=${taskId}`)
}

function goAi(prompt: string) {
  router.push(`/ai?prompt=${encodeURIComponent(prompt)}`)
}

const viewMode = ref<ViewMode>('day')

const tabs: { value: ViewMode; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
  { value: 'year', label: '年' },
  { value: 'all', label: '全部' },
]

// ---- 工具函数 ----
function getWeekNumber(d: Date) {
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
  const yearStart = new Date(tmp.getFullYear(), 0, 1)
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay() || 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function isInWeek(dateStr: string, weekStart: Date, weekEnd: Date) {
  const d = new Date(dateStr)
  return d >= weekStart && d <= weekEnd
}

function getWeekdayName(dateStr: string) {
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return names[new Date(dateStr).getDay()]
}

/** 与首页今日任务列表对齐的排序：
 *  未完成 → startDate + startTime 升序（有开始日期优先），再按 startTime 升序
 *    无开始日期的任务排在后面，按 createdAt 降序
 *  已完成 → completedAt 降序，统一排在最后 */
function sortAligned(tasks: Task[]): Task[] {
  const active: Task[] = []
  const done: Task[] = []
  for (const t of tasks) {
    if (t.status === 'done') done.push(t)
    else active.push(t)
  }
  active.sort((a, b) => {
    // 两端都有 startDate：按 startDate 升序，再按 startTime 升序
    if (a.startDate && b.startDate) {
      const dateCmp = a.startDate.localeCompare(b.startDate)
      if (dateCmp !== 0) return dateCmp
      const aTime = a.startTime || '00:00'
      const bTime = b.startTime || '00:00'
      return aTime.localeCompare(bTime)
    }
    // 仅 a 有 startDate：a 排在前面
    if (a.startDate && !b.startDate) return -1
    // 仅 b 有 startDate：b 排在前面
    if (!a.startDate && b.startDate) return 1
    // 两端都无 startDate：按 createdAt 降序（最新创建的在前）
    return b.createdAt.localeCompare(a.createdAt)
  })
  done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  return [...active, ...done]
}

// ---- Day view ----
const dayTasks = computed(() => {
  const d = props.selectedDate
  const today = toLocalDate()
  const isToday = d === today

  const filtered = props.tasks.filter(t => {
    // 1. 开始日期为选中日期
    if (t.startDate === d) return true
    // 2. 开始日期早于选中日期且未完成（延迟任务）—— 仅今日视图显示
    if (isToday && t.startDate && t.startDate < d && t.status !== 'done') return true
    // 3. 无开始日期（旧数据）→ 回退到 createdAt 逻辑
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(d)
      if (isToday) {
        const createdBeforeAndUndone = t.createdAt.slice(0, 10) < d && t.status !== 'done'
        const completedOnDay = t.completedAt && t.completedAt.startsWith(d)
        return createdOnDay || createdBeforeAndUndone || completedOnDay
      }
      return createdOnDay
    }
    // 4. 选中日期完成的任务（无论开始日期是什么，方便追溯）
    if (t.completedAt && t.completedAt.startsWith(d)) return true
    return false
  })
  return sortAligned(filtered.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

/** 是否显示日期标签：未完成且日期（开始日期或创建日期）与选中日期不同 */
function showCreatedDate(task: Task) {
  if (task.status === 'done') return false
  if (task.startDate) return task.startDate !== props.selectedDate
  return task.createdAt.slice(0, 10) !== props.selectedDate
}

/** 日期标签文本："计划 MM-DD" 或 "创建 MM-DD" */
function dateTagText(task: Task): string {
  if (task.startDate && task.startDate !== props.selectedDate) {
    return `计划 ${formatDate(task.startDate)}`
  }
  return `创建 ${formatDate(task.createdAt.slice(0, 10))}`
}

/** 日期标签是否为"计划"类型（用于样式区分） */
function isPlannedDate(task: Task): boolean {
  return !!task.startDate && task.startDate !== props.selectedDate
}

/** 任务是否属于未来日期（状态锁定为"待办"，不可切换） */
function isFutureTask(task: Task) {
  const today = toLocalDate()
  if (task.startDate) return task.startDate > today
  // 无 startDate 时回退到 createdAt 逻辑（旧数据兼容）
  return task.createdAt.slice(0, 10) > today
}

/** 是否需要显示截止日期 */
function showDueDate(task: Task) {
  if (!task.dueDate) return false
  // 未完成：始终显示截止日期
  if (task.status !== 'done') return true
  // 已完成：仅当截止日期已过（延期完成）时显示
  const today = toLocalDate()
  return task.dueDate < today
}

/** 截止日期是否已过期 */
function isOverdue(task: Task) {
  if (!task.dueDate) return false
  const today = toLocalDate()
  return task.dueDate < today
}

/** 计算逾期天数 */
function overdueDays(task: Task): number {
  if (!task.dueDate) return 0
  const due = new Date(task.dueDate)
  const now = new Date(todayStr)
  return Math.floor((now.getTime() - due.getTime()) / 86400000)
}

/** 日视图中：任务在选中日期完成，但开始日期不是选中日期 → 显示原定开始日期 */
function showPlannedDate(task: Task): boolean {
  if (task.status !== 'done') return false
  if (!task.completedAt) return false
  const d = props.selectedDate
  if (!task.completedAt.startsWith(d)) return false
  const sd = task.startDate || task.createdAt.slice(0, 10)
  return sd !== d
}

/** 格式化日期 MM-DD */
function formatDate(dateStr: string) {
  return dateStr.slice(5, 10)
}

const dayHeader = computed(() => {
  const d = new Date(props.selectedDate)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${getWeekdayName(props.selectedDate)}`
})

// ---- Week view ----
const weekRange = computed(() => getWeekRange(props.selectedDate))
const weekNumber = computed(() => getWeekNumber(new Date(props.selectedDate)))

const weekTasks = computed(() => {
  const { monday, sunday } = weekRange.value
  const filtered = props.tasks.filter(t => {
    // 有开始日期：按开始日期判断
    if (t.startDate) return isInWeek(t.startDate, monday, sunday)
    // 无开始日期：回退到 createdAt
    if (isInWeek(t.createdAt, monday, sunday)) return true
    // 完成日期在本周
    if (t.completedAt && isInWeek(t.completedAt, monday, sunday)) return true
    return false
  })
  return sortAligned(filtered.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

// ---- Month view ----
const monthTasks = computed(() => {
  const d = new Date(props.selectedDate)
  const y = d.getFullYear()
  const m = d.getMonth()
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`
  const filtered = props.tasks.filter(t => {
    // 有开始日期：按开始日期前缀判断
    if (t.startDate) return t.startDate.startsWith(prefix)
    // 无开始日期：回退到 createdAt
    if (t.createdAt.startsWith(prefix)) return true
    // 完成日期在本月
    if (t.completedAt && t.completedAt.startsWith(prefix)) return true
    return false
  })
  return sortAligned(filtered.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

const monthHeader = computed(() => {
  const d = new Date(props.selectedDate)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

// ---- Quarter view ----
const quarterInfo = computed(() => {
  const d = new Date(props.selectedDate)
  const q = Math.floor(d.getMonth() / 3) + 1
  const startMonth = (q - 1) * 3
  return { year: d.getFullYear(), quarter: q, startMonth }
})

const quarterTasks = computed(() => {
  const { year, startMonth } = quarterInfo.value
  const tasks: Task[] = []
  for (let m = startMonth; m < startMonth + 3; m++) {
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}`
    tasks.push(...props.tasks.filter(t => {
      // 有开始日期：按开始日期前缀判断
      if (t.startDate) return t.startDate.startsWith(prefix)
      // 无开始日期：回退到 createdAt
      if (t.createdAt.startsWith(prefix)) return true
      // 完成日期在本季度
      if (t.completedAt && t.completedAt.startsWith(prefix)) return true
      return false
    }))
  }
  // deduplicate
  const seen = new Set<string>()
  const unique = tasks.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
  return sortAligned(unique.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

const quarterHeader = computed(() => {
  const { year, quarter } = quarterInfo.value
  return `${year}年第${quarter}季度`
})

// ---- Year view ----
const yearTasks = computed(() => {
  const y = new Date(props.selectedDate).getFullYear()
  const prefix = `${y}-`
  const filtered = props.tasks.filter(t => {
    // 有开始日期：按开始日期前缀判断
    if (t.startDate) return t.startDate.startsWith(prefix)
    // 无开始日期：回退到 createdAt
    if (t.createdAt.startsWith(prefix)) return true
    // 完成日期在本年
    if (t.completedAt && t.completedAt.startsWith(prefix)) return true
    return false
  })
  return sortAligned(filtered.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

const yearHeader = computed(() => {
  return `${new Date(props.selectedDate).getFullYear()}年`
})

// ---- All view (全部任务总览) ----
const allTasks = computed(() => {
  return sortAligned(props.tasks.filter(t => activeFilter.value === 'all' || t.status === activeFilter.value))
})

const allStats = computed(() => {
  const all = props.tasks
  return {
    total: all.length,
    todo: all.filter(t => t.status === 'todo').length,
    inProgress: all.filter(t => t.status === 'in_progress').length,
    done: all.filter(t => t.status === 'done').length,
  }
})

const todayStr = toLocalDate()
const overdueTasks = computed(() => {
  return props.tasks.filter(t => {
    if (!t.dueDate) return false
    if (t.status === 'done') return false
    return t.dueDate < todayStr
  }).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
})

const highPriorityPending = computed(() => {
  return props.tasks.filter(t => {
    return t.priority === 'high' && t.status !== 'done'
  }).sort((a, b) => {
    const da = a.startDate || a.createdAt.slice(0, 10)
    const db = b.startDate || b.createdAt.slice(0, 10)
    return da.localeCompare(db)
  })
})

// ---- 通用统计 ----
function getStats(taskList: Task[]) {
  return {
    total: taskList.length,
    inProgress: taskList.filter(t => t.status === 'in_progress').length,
    done: taskList.filter(t => t.status === 'done').length,
  }
}

function getCompletion(taskList: Task[]) {
  const total = taskList.length
  return total === 0 ? 0 : Math.round((taskList.filter(t => t.status === 'done').length / total) * 100)
}

// 分布图数据（周：按天，月：按周，季：按月，年：按月）
function getDistribution(taskList: Task[], mode: ViewMode) {
  if (mode === 'week') {
    const { monday } = weekRange.value
    const days: { label: string; date: string; count: number; done: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dk = toLocalDate(d)
      const dayT = props.tasks.filter(t =>
        t.createdAt.startsWith(dk) || (t.completedAt && t.completedAt.startsWith(dk))
      )
      days.push({
        label: String(d.getDate()),
        date: dk,
        count: dayT.length,
        done: dayT.filter(t => t.status === 'done').length,
      })
    }
    return days
  }

  if (mode === 'month') {
    const d = new Date(props.selectedDate)
    const y = d.getFullYear()
    const m = d.getMonth()
    const lastDay = new Date(y, m + 1, 0).getDate()
    // 按周分
    const weeks: { label: string; date: string; count: number; done: number }[] = []
    let weekStart = 1
    let weekIdx = 1
    while (weekStart <= lastDay) {
      const weekEnd = Math.min(weekStart + 6, lastDay)
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}`
      const weekT = taskList.filter(t => {
        const day = parseInt(t.createdAt.slice(8, 10))
        return day >= weekStart && day <= weekEnd
      })
      weeks.push({
        label: `第${weekIdx}周`,
        date: `${prefix}-${String(weekStart).padStart(2, '0')}`,
        count: weekT.length,
        done: weekT.filter(t => t.status === 'done').length,
      })
      weekStart = weekEnd + 1
      weekIdx++
    }
    return weeks
  }

  if (mode === 'quarter') {
    const { year, startMonth } = quarterInfo.value
    const months: { label: string; date: string; count: number; done: number }[] = []
    for (let m = startMonth; m < startMonth + 3; m++) {
      const prefix = `${year}-${String(m + 1).padStart(2, '0')}`
      const monthT = props.tasks.filter(t =>
        t.createdAt.startsWith(prefix) || (t.completedAt && t.completedAt.startsWith(prefix))
      )
      months.push({
        label: `${m + 1}月`,
        date: prefix,
        count: monthT.length,
        done: monthT.filter(t => t.status === 'done').length,
      })
    }
    return months
  }

  // year: 按月
  const y = new Date(props.selectedDate).getFullYear()
  const months: { label: string; date: string; count: number; done: number }[] = []
  for (let m = 0; m < 12; m++) {
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`
    const monthT = props.tasks.filter(t =>
      t.createdAt.startsWith(prefix) || (t.completedAt && t.completedAt.startsWith(prefix))
    )
    months.push({
      label: `${m + 1}月`,
      date: prefix,
      count: monthT.length,
      done: monthT.filter(t => t.status === 'done').length,
    })
  }
  return months
}

// 当前视图的数据
const currentTasks = computed(() => {
  switch (viewMode.value) {
    case 'all': return allTasks.value
    case 'day': return dayTasks.value
    case 'week': return weekTasks.value
    case 'month': return monthTasks.value
    case 'quarter': return quarterTasks.value
    case 'year': return yearTasks.value
    default: return []
  }
})

// ---- Progressive rendering (virtual scroll alternative) ----
// Render first N items, load more when scrolling near bottom.
// Solves DOM node explosion when 500+ tasks exist in "All" view.
const DISPLAY_BATCH = 50
const displayLimit = ref(DISPLAY_BATCH)
const sentinelRef = ref<HTMLElement | null>(null)
let ioObserver: IntersectionObserver | null = null

const dayTasksDisplay = computed(() => dayTasks.value.slice(0, displayLimit.value))
const allTasksDisplay = computed(() => allTasks.value.slice(0, displayLimit.value))
const currentTasksDisplay = computed(() => currentTasks.value.slice(0, displayLimit.value))

function setupObserver() {
  if (ioObserver) ioObserver.disconnect()
  ioObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        displayLimit.value += DISPLAY_BATCH
      }
    },
    { rootMargin: '200px' },
  )
  if (sentinelRef.value) ioObserver.observe(sentinelRef.value)
}

// Re-connect observer when sentinel element mounts (view switches)
watch(sentinelRef, (el) => {
  if (el) setupObserver()
})

// Reset limit when view/date/filter changes
watch([viewMode, () => props.selectedDate, () => props.statusFilter], () => {
  displayLimit.value = DISPLAY_BATCH
})

onBeforeUnmount(() => {
  ioObserver?.disconnect()
})

const currentStats = computed(() => getStats(currentTasks.value))
const currentCompletion = computed(() => getCompletion(currentTasks.value))
const currentDistribution = computed(() => getDistribution(currentTasks.value, viewMode.value))
const maxDistCount = computed(() => Math.max(1, ...currentDistribution.value.map(d => d.count)))

const currentHeader = computed(() => {
  switch (viewMode.value) {
    case 'all': return '全部任务'
    case 'day': return dayHeader.value
    case 'week': return `第 ${weekNumber.value} 周`
    case 'month': return monthHeader.value
    case 'quarter': return quarterHeader.value
    case 'year': return yearHeader.value
    default: return ''
  }
})

// ---- 通用 ----
const priorityColorMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    high: d ? '#f87171' : z ? '#CB312D' : t ? '#f87171' : '#ef4444',
    medium: d ? '#60a5fa' : z ? '#999999' : t ? '#0052D9' : '#3b82f6',
    low: d ? '#4ade80' : z ? '#BFBFBF' : t ? '#00a870' : '#22c55e',
  }
})

const priorityLabelMap: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const priorityBgMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    high: d ? '#2d1516' : z ? '#F9EBEB' : t ? '#EDF1FF' : '#fef2f2',
    medium: d ? '#162032' : z ? '#F5F5F5' : t ? '#EDF1FF' : '#eff6ff',
    low: d ? '#0f2e1c' : z ? '#F5F5F5' : t ? '#E8F8EE' : '#f0fdf4',
  }
})

const statusLabelMap: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
}

const statusColorMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    todo: d ? '#cbd5e1' : z ? '#666666' : t ? '#666666' : '#475569',
    in_progress: d ? '#fbbf24' : z ? '#AD2A26' : t ? '#0052D9' : '#d97706',
    done: d ? '#4ade80' : z ? '#CB312D' : t ? '#00a870' : '#16a34a',
  }
})

const statusBgMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    todo: d ? '#252730' : z ? '#F5F5F5' : t ? '#F5F5F5' : '#f1f5f9',
    in_progress: d ? '#2d2006' : z ? '#FFF5F5' : t ? '#EDF1FF' : '#fffbeb',
    done: d ? '#0f2e1c' : z ? '#F9EBEB' : t ? '#E8F8EE' : '#f0fdf4',
  }
})

// ---- TaskEditModal ----
const modalRef = ref<InstanceType<typeof TaskEditModal> | null>(null)

// ---- TaskDetailModal ----
const detailModalRef = ref<InstanceType<typeof TaskDetailModal> | null>(null)

function openNew() {
  modalRef.value?.openNew(props.selectedDate)
}

function openEdit(task: Task) {
  modalRef.value?.openEdit(task)
}

function openView(task: Task) {
  detailModalRef.value?.open(task)
}

function openCopy(task: Task) {
  modalRef.value?.openCopy(task, props.selectedDate)
}

// ---- Selected task for copy ----
const selectedTaskId = ref<string | null>(null)

function toggleSelect(task: Task) {
  if (selectedTaskId.value === task.id) {
    selectedTaskId.value = null
  } else {
    selectedTaskId.value = task.id
  }
}

// ---- Delete confirm ----
const confirmVisible = ref(false)
const confirmTarget = ref<Task | null>(null)

function requestDelete(task: Task) {
  if (task.status === 'done') return
  confirmTarget.value = task
  confirmVisible.value = true
}

function confirmDelete() {
  if (confirmTarget.value) {
    store.deleteTask(confirmTarget.value.id)
  }
  confirmVisible.value = false
  confirmTarget.value = null
}

function cancelDelete() {
  confirmVisible.value = false
  confirmTarget.value = null
}

// ---- Status toggle ----
function cycleStatus(task: Task) {
  // DEF-04 fix: Reuse isFutureTask() for consistent future-task check
  // (isFutureTask prioritizes task.startDate over task.createdAt)
  if (isFutureTask(task)) return
  store.requestToggleStatus(task.id)
}

// ---- Detail popup ----
const detailTask = ref<Task | null>(null)
const detailHtml = computed(() => {
  if (!detailTask.value?.description) return ''
  const raw = marked.parse(detailTask.value.description, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw)
})
function showDetail(task: Task) {
  detailTask.value = task
}
function closeDetail() {
  detailTask.value = null
}

// ---- Copy list ----
function copyList() {
  const text = currentTasks.value.map((t, i) => `${i + 1}. ${t.title}`).join('\n')
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copyTip.value = '已复制'
    setTimeout(() => copyTip.value = '', 1200)
  })
}
const copyTip = ref('')

// ---- 实际执行时间 + 状态编辑 ----
const inProgressAtInput = ref('')
const completedAtInput = ref('')
const detailStatusInput = ref<TaskStatus>('todo')

/** datetime-local 格式与 ISO 时间戳互转 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

/** 详情弹窗打开时回填实际执行时间与状态 */
watch(detailTask, (task) => {
  if (task) {
    inProgressAtInput.value = toDatetimeLocal(task.inProgressAt)
    completedAtInput.value = toDatetimeLocal(task.completedAt)
    detailStatusInput.value = task.status
  }
})

/** 弹窗中切换状态时，自动补全对应时间字段（若尚未填写） */
function onDetailStatusChange(newStatus: TaskStatus) {
  // 注意：datetime-local 控件是「本地时区」语义，必须从 new Date() 直接取本地时区字段，
  // 不能再走 new Date().toISOString()（那是 UTC，会少 8 小时）
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (newStatus === 'in_progress' && !inProgressAtInput.value) {
    inProgressAtInput.value = now
  }
  if (newStatus === 'done') {
    if (!inProgressAtInput.value) inProgressAtInput.value = now
    if (!completedAtInput.value) completedAtInput.value = now
  }
  detailStatusInput.value = newStatus
}

/** 保存实际执行时间与状态 */
function saveTimestamps() {
  if (!detailTask.value) return

  const originalStatus = detailTask.value.status
  const newStatus = detailStatusInput.value

  // 已完成 → 非完成：需走重新激活确认流程
  if (originalStatus === 'done' && newStatus !== 'done') {
    // 构造确认后的完整 patch
    const patch: Record<string, any> = { status: newStatus }
    const iptVal = fromDatetimeLocal(inProgressAtInput.value)
    const cptVal = fromDatetimeLocal(completedAtInput.value)
    if (iptVal) patch.inProgressAt = iptVal
    if (cptVal) patch.completedAt = cptVal
    store.reactivateConfirm.taskId = detailTask.value.id
    store.reactivateConfirm.taskTitle = detailTask.value.title
    store.reactivateConfirm.extraPatch = patch as any
    store.reactivateConfirm.visible = true
    closeDetail()
    return
  }

  const patch: Record<string, any> = { status: newStatus }
  const iptVal = fromDatetimeLocal(inProgressAtInput.value)
  const cptVal = fromDatetimeLocal(completedAtInput.value)
  if (iptVal) patch.inProgressAt = iptVal
  if (cptVal) patch.completedAt = cptVal
  store.updateTask(detailTask.value.id, patch as any)
  closeDetail()
}
</script>

<template>
  <div class="right-panel">
    <!-- Tab bar -->
    <div class="rp-tabs-row">
      <div class="rp-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['rp-tab', { active: viewMode === tab.value }]"
          @click="viewMode = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <!-- Status filter inline -->
      <div class="rp-status-filter">
        <button
          v-for="s in statusOptions"
          :key="s.value"
          :class="['rp-status-btn', { active: activeFilter === s.value }]"
          @click="emit('update:statusFilter', s.value)"
        >{{ s.label }}</button>
      </div>
      <div class="rp-tabs-actions">
        <button class="ai-quick-btn" @click="goAi('分析我今天的任务，给出优先级建议')" title="智能分析">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
          智能分析
        </button>
        <button class="ai-quick-btn" @click="goAi('分析我的逾期任务，给出处理建议')" title="逾期处理">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          逾期处理
        </button>
        <button class="ai-quick-btn" @click="goAi('帮我拆解当前待办任务为更小的可执行步骤')" title="任务拆解">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          任务拆解
        </button>
      </div>
    </div>

    <!-- Scrollable content area -->
    <div class="rp-scroll-area">
      <!-- ========== Day View ========== -->
      <template v-if="viewMode === 'day'">
        <div class="rp-header">
          <h3 class="rp-title">{{ dayHeader }}</h3>
          <div class="rp-header-actions">
            <button
              class="btn-copy-task"
              :disabled="!selectedTaskId"
              @click="selectedTaskId && openCopy(currentTasks.find(t => t.id === selectedTaskId)!)"
              title="复制选中任务"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制
            </button>
            <button class="btn-copy" @click="copyList">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {{ copyTip || '复制列表' }}
            </button>
            <button class="btn-add-task" @click="openNew" title="添加任务">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              添加
            </button>
          </div>
        </div>

        <div class="rp-body">
          <div v-if="dayTasks.length === 0" class="rp-empty">
            {{ activeFilter === 'all' ? '该日期暂无任务' : '该日期无' + (statusLabelMap[activeFilter] || '匹配') + '任务' }}
          </div>
          <div v-else class="task-list">
            <div
              v-for="task in dayTasksDisplay"
              :key="task.id"
              :class="['task-card', { 'task-done': task.status === 'done' }, { 'task-selected': selectedTaskId === task.id }]"
              @click="toggleSelect(task)"
            >
              <div class="tc-top">
                <span class="tc-title" @click.stop="openView(task)">{{ task.title }}</span>
                <div class="tc-actions">
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-copy" @click.stop="openCopy(task)" title="复制">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-edit" @click.stop="openEdit(task)" title="编辑">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-delete" @click.stop="requestDelete(task)" title="删除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-time" @click.stop="showDetail(task)" title="编辑执行时间">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-ai" @click.stop="analyzeTask(task.id)" title="AI 分析">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-view" @click.stop="openView(task)" title="查看详情">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="tc-meta">
                <span
                  class="tc-priority"
                  :style="{ background: priorityBgMap[task.priority], color: priorityColorMap[task.priority] }"
                >{{ priorityLabelMap[task.priority] }}</span>
                <span
                  class="tc-status"
                  :class="{ 'tc-status-locked': isFutureTask(task) }"
                  :style="{ background: statusBgMap[task.status], color: statusColorMap[task.status] }"
                  @click.stop="!isFutureTask(task) && cycleStatus(task)"
                >{{ statusLabelMap[task.status] }}</span>
                <span
                  v-if="task.status === 'done' && task.inProgressAt"
                  class="tc-duration"
                >耗时 {{ formatDuration(task) }}</span>
                <span v-if="showCreatedDate(task)" :class="['tc-date', isPlannedDate(task) ? 'planned' : 'created']">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {{ dateTagText(task) }}
                </span>
                <span
                  v-if="showDueDate(task)"
                  :class="['tc-date', 'due', { overdue: isOverdue(task) }]"
                >
                  <template v-if="isOverdue(task)">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    延期 {{ formatDate(task.dueDate!) }}
                  </template>
                  <template v-else>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    截止 {{ formatDate(task.dueDate!) }}
                  </template>
                </span>
                <span
                  v-if="showPlannedDate(task)"
                  class="tc-date planned"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  计划 {{ formatDate(task.startDate || task.createdAt.slice(0, 10)) }}
                </span>
              </div>
            </div>
            <div v-if="dayTasks.length > displayLimit" ref="sentinelRef" class="rp-sentinel"></div>
          </div>
        </div>
      </template>

      <!-- ========== All View (全部任务总览) ========== -->
      <template v-else-if="viewMode === 'all'">
        <!-- Stats cards (4 cols) -->
        <div class="stats-row stats-row-all">
          <div class="stat-card">
            <div class="stat-num">{{ allStats.total }}</div>
            <div class="stat-label">总任务</div>
          </div>
          <div class="stat-card stat-card-todo">
            <div class="stat-num">{{ allStats.todo }}</div>
            <div class="stat-label">待办</div>
          </div>
          <div class="stat-card stat-card-progress">
            <div class="stat-num">{{ allStats.inProgress }}</div>
            <div class="stat-label">进行中</div>
          </div>
          <div class="stat-card stat-card-done">
            <div class="stat-num">{{ allStats.done }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>

        <!-- Focus area: overdue + high priority -->
        <div class="all-focus-row" v-if="overdueTasks.length > 0 || highPriorityPending.length > 0">
          <div v-if="overdueTasks.length > 0" class="all-focus-card all-focus-danger">
            <div class="all-focus-header">
              <span class="all-focus-title">逾期任务</span>
              <span class="all-focus-badge danger">{{ overdueTasks.length }} 项</span>
            </div>
            <div class="all-focus-list">
              <div
                v-for="t in overdueTasks.slice(0, 4)"
                :key="t.id"
                class="all-focus-item"
                @click="openView(t)"
              >
                <span class="all-focus-dot danger"></span>
                <span class="all-focus-name">{{ t.title }}</span>
                <span class="all-focus-tag danger">逾期 {{ overdueDays(t) }} 天</span>
              </div>
              <div v-if="overdueTasks.length > 4" class="all-focus-more">+ 还有 {{ overdueTasks.length - 4 }} 项</div>
            </div>
          </div>

          <div v-if="highPriorityPending.length > 0" class="all-focus-card">
            <div class="all-focus-header">
              <span class="all-focus-title">高优先级待处理</span>
              <span class="all-focus-badge">{{ highPriorityPending.length }} 项</span>
            </div>
            <div class="all-focus-list">
              <div
                v-for="t in highPriorityPending.slice(0, 4)"
                :key="t.id"
                class="all-focus-item"
                @click="openView(t)"
              >
                <span
                  class="tc-priority"
                  :style="{ background: priorityBgMap[t.priority], color: priorityColorMap[t.priority] }"
                >高</span>
                <span class="all-focus-name">{{ t.title }}</span>
                <span class="all-focus-date">{{ formatDate(t.startDate || t.createdAt.slice(0, 10)) }}</span>
              </div>
              <div v-if="highPriorityPending.length > 4" class="all-focus-more">+ 还有 {{ highPriorityPending.length - 4 }} 项</div>
            </div>
          </div>
        </div>

        <!-- Status distribution bar -->
        <div class="dist-section" v-if="allStats.total > 0">
          <div class="dist-title">状态分布</div>
          <div class="all-dist-bar">
            <div class="all-dist-seg todo" :style="{ flex: `0 0 ${allStats.todo / allStats.total * 100}%` }" />
            <div class="all-dist-seg progress" :style="{ flex: `0 0 ${allStats.inProgress / allStats.total * 100}%` }" />
            <div class="all-dist-seg done" :style="{ flex: `0 0 ${allStats.done / allStats.total * 100}%` }" />
          </div>
          <div class="all-dist-legend">
            <span class="legend-item todo">待办 {{ allStats.todo }} · {{ Math.round(allStats.todo / allStats.total * 100) }}%</span>
            <span class="legend-item progress">进行中 {{ allStats.inProgress }} · {{ Math.round(allStats.inProgress / allStats.total * 100) }}%</span>
            <span class="legend-item done">已完成 {{ allStats.done }} · {{ Math.round(allStats.done / allStats.total * 100) }}%</span>
          </div>
        </div>

        <!-- All tasks list -->
        <div class="rp-body">
          <div class="detail-list-header">
            <span class="detail-list-title">全部任务 ({{ allTasks.length }})</span>
            <button class="btn-copy" @click="copyList">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {{ copyTip || '复制列表' }}
            </button>
          </div>
          <div v-if="allTasks.length === 0" class="rp-empty">
            {{ activeFilter === 'all' ? '暂无任务' : '无' + (statusLabelMap[activeFilter] || '匹配') + '任务' }}
          </div>
          <div v-else class="task-list">
            <div
              v-for="task in allTasksDisplay"
              :key="task.id"
              :class="['task-card', { 'task-done': task.status === 'done' }, { 'task-selected': selectedTaskId === task.id }]"
              @click="toggleSelect(task)"
            >
              <div class="tc-top">
                <span class="tc-title" @click.stop="openView(task)">{{ task.title }}</span>
                <div class="tc-actions">
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-copy" @click.stop="openCopy(task)" title="复制">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-edit" @click.stop="openEdit(task)" title="编辑">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-delete" @click.stop="requestDelete(task)" title="删除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-time" @click.stop="showDetail(task)" title="编辑执行时间">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-ai" @click.stop="analyzeTask(task.id)" title="AI 分析">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-view" @click.stop="openView(task)" title="查看详情">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="tc-meta">
                <span
                  class="tc-priority"
                  :style="{ background: priorityBgMap[task.priority], color: priorityColorMap[task.priority] }"
                >{{ priorityLabelMap[task.priority] }}</span>
                <span
                  class="tc-status"
                  :class="{ 'tc-status-locked': isFutureTask(task) }"
                  :style="{ background: statusBgMap[task.status], color: statusColorMap[task.status] }"
                  @click.stop="!isFutureTask(task) && cycleStatus(task)"
                >{{ statusLabelMap[task.status] }}</span>
                <span v-if="task.status === 'done' && task.inProgressAt" class="tc-duration">耗时 {{ formatDuration(task) }}</span>
                <span class="tc-date created">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {{ formatDate(task.startDate || task.createdAt.slice(0, 10)) }}
                </span>
                <span
                  v-if="task.dueDate && task.status !== 'done'"
                  :class="['tc-date', 'due', { overdue: task.dueDate < todayStr }]"
                >
                  <template v-if="task.dueDate < todayStr">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    延期 {{ formatDate(task.dueDate) }}
                  </template>
                  <template v-else>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    截止 {{ formatDate(task.dueDate) }}
                  </template>
                </span>
              </div>
            </div>
            <div v-if="allTasks.length > displayLimit" ref="sentinelRef" class="rp-sentinel"></div>
          </div>
        </div>
      </template>

      <!-- ========== Week / Month / Quarter / Year View ========== -->
      <template v-else>
        <div class="rp-header">
          <h3 class="rp-title">{{ currentHeader }} <span class="rp-sub">共 {{ currentStats.total }} 项任务</span></h3>
          <div class="rp-header-actions">
            <button
              v-if="viewMode === 'week'"
              class="btn-copy-task"
              :disabled="!selectedTaskId"
              @click="selectedTaskId && openCopy(currentTasks.find(t => t.id === selectedTaskId)!)"
              title="复制选中任务"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制列表
            </button>
          </div>
        </div>

        <!-- Stats cards -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon total">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div class="stat-num">{{ currentStats.total }}</div>
            <div class="stat-label">总任务</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon progress">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-num">{{ currentStats.inProgress }}</div>
            <div class="stat-label">进行中</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="stat-num">{{ currentStats.done }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>

        <!-- Completion rate -->
        <div class="rate-section">
          <div class="rate-header">
            <span class="rate-label">完成率</span>
            <span class="rate-value">{{ currentCompletion }}%</span>
          </div>
          <div class="rate-bar">
            <div class="rate-fill" :style="{ width: currentCompletion + '%' }" />
          </div>
        </div>

        <!-- Distribution chart -->
        <div class="dist-section">
          <div class="dist-title">任务分布</div>
          <div class="dist-chart">
            <div
              v-for="item in currentDistribution"
              :key="item.date"
              class="dist-col"
            >
              <div class="dist-bar-wrap">
                <div
                  class="dist-bar"
                  :style="{ height: item.count > 0 ? (item.count / maxDistCount * 60) + 'px' : '0px' }"
                />
              </div>
              <span class="dist-label">{{ item.label }}</span>
            </div>
          </div>
          <div class="dist-legend">
            <span class="legend-all">全部</span>
            <span class="legend-done"><span class="legend-dot" />已完成</span>
          </div>
        </div>

        <!-- Task detail list -->
        <div class="rp-body">
          <div class="detail-list-header">
            <span class="detail-list-title">任务明细 ({{ currentTasks.length }})</span>
            <button class="btn-copy" @click="copyList">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {{ copyTip || '复制列表' }}
            </button>
          </div>
          <div v-if="currentTasks.length === 0" class="rp-empty">
            {{ activeFilter === 'all' ? '暂无任务' : '无' + (statusLabelMap[activeFilter] || '匹配') + '任务' }}
          </div>
          <div v-else class="task-list">
            <div
              v-for="task in currentTasksDisplay"
              :key="task.id"
              :class="['task-card', { 'task-done': task.status === 'done' }, { 'task-selected': selectedTaskId === task.id }]"
              @click="toggleSelect(task)"
            >
              <div class="tc-top">
                <span class="tc-title" @click.stop="openView(task)">{{ task.title }}</span>
                <div class="tc-actions">
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-copy" @click.stop="openCopy(task)" title="复制">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-edit" @click.stop="openEdit(task)" title="编辑">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-delete" @click.stop="requestDelete(task)" title="删除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button v-if="task.status !== 'done'" class="tc-btn tc-btn-time" @click.stop="showDetail(task)" title="编辑执行时间">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-ai" @click.stop="analyzeTask(task.id)" title="AI 分析">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
                    </svg>
                  </button>
                  <button class="tc-btn tc-btn-view" @click.stop="openView(task)" title="查看详情">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="tc-meta">
                <span
                  class="tc-priority"
                  :style="{ background: priorityBgMap[task.priority], color: priorityColorMap[task.priority] }"
                >{{ priorityLabelMap[task.priority] }}</span>
                <span
                  class="tc-status"
                  :class="{ 'tc-status-locked': isFutureTask(task) }"
                  :style="{ background: statusBgMap[task.status], color: statusColorMap[task.status] }"
                  @click.stop="!isFutureTask(task) && cycleStatus(task)"
                >{{ statusLabelMap[task.status] }}</span>
                <span v-if="showCreatedDate(task)" :class="['tc-date', isPlannedDate(task) ? 'planned' : 'created']">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {{ dateTagText(task) }}
                </span>
                <span
                  v-if="showDueDate(task)"
                  :class="['tc-date', 'due', { overdue: isOverdue(task) }]"
                >
                  <template v-if="isOverdue(task)">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    延期 {{ formatDate(task.dueDate!) }}
                  </template>
                  <template v-else>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    截止 {{ formatDate(task.dueDate!) }}
                  </template>
                </span>
              </div>
            </div>
            <div v-if="currentTasks.length > displayLimit" ref="sentinelRef" class="rp-sentinel"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- TaskEditModal -->
    <TaskEditModal ref="modalRef" />

    <!-- TaskDetailModal -->
    <TaskDetailModal ref="detailModalRef" />

    <!-- Delete confirm dialog -->
    <ConfirmDialog
      :visible="confirmVisible"
      title="确认删除"
      :message="`确定要删除任务「<strong>${confirmTarget?.title}</strong>」吗？<br/>删除后将移入回收站，7 天后自动永久删除。`"
      confirm-text="确认删除"
      type="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Detail popup -->
    <Teleport to="body">
      <div v-if="detailTask" class="detail-overlay" @click="closeDetail">
        <div class="detail-popup" @click.stop>
          <div class="detail-header">
            <h4 class="detail-title">{{ detailTask.title }}</h4>
            <button class="detail-close" @click="closeDetail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="detail-meta">
            <span
              class="detail-pri"
              :style="{ background: priorityBgMap[detailTask.priority], color: priorityColorMap[detailTask.priority] }"
            >{{ priorityLabelMap[detailTask.priority] }}优先级</span>
            <span
              class="detail-status"
              :style="{ background: statusBgMap[detailTask.status], color: statusColorMap[detailTask.status] }"
            >{{ statusLabelMap[detailTask.status] }}</span>
            <span v-if="detailTask.dueDate" class="detail-due">截止: {{ detailTask.dueDate }}</span>
            <span
              v-if="detailTask.status === 'done' && detailTask.inProgressAt"
              class="detail-duration"
            >耗时 {{ formatDuration(detailTask) }}</span>
          </div>

          <div v-if="detailTask" class="detail-time-row">
            <!-- 状态选择 -->
            <div class="detail-status-row">
              <button
                v-for="s in ([{ value: 'todo', label: '待办' }, { value: 'in_progress', label: '进行中' }, { value: 'done', label: '已完成' }] as const)"
                :key="s.value"
                :class="['detail-status-btn', { active: detailStatusInput === s.value }]"
                @click="onDetailStatusChange(s.value)"
              >{{ s.label }}</button>
            </div>
            <!-- 时间编辑 -->
            <div class="detail-time-inputs">
              <input v-model="inProgressAtInput" type="datetime-local" class="detail-time-input" placeholder="实际开始" title="实际开始时间" />
              <span class="detail-time-sep">—</span>
              <input v-model="completedAtInput" type="datetime-local" class="detail-time-input" placeholder="实际完成" title="实际完成时间" />
            </div>
            <button class="detail-time-save" @click="saveTimestamps">保存</button>
          </div>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

/* ---- Scrollable area ---- */
.rp-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- Status filter ---- */
.rp-status-filter {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.rp-status-btn {
  padding: 4px 14px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  font-size: 12px;
  color: var(--color-text-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.rp-status-btn:hover {
  background: var(--color-bg-3);
  color: var(--color-text-1);
}

.rp-status-btn.active {
  background: var(--color-success);
  color: var(--color-white);
  border-color: var(--color-success);
}

/* ---- Tabs ---- */
.rp-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0 0 8px;
}

.rp-tabs {
  display: flex;
  gap: 4px;
  background: var(--color-surface);
  padding: 4px;
  border-radius: 10px;
  box-shadow: 0 1px 3px var(--color-shadow);
  width: fit-content;
  flex-shrink: 0;
}

.rp-tabs-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.ai-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-accent-light);
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 14px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.ai-quick-btn:hover {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

.ai-quick-btn svg {
  flex-shrink: 0;
}

.rp-tab {
  padding: 5px 14px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--color-text-3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.rp-tab.active {
  background: var(--color-success);
  color: var(--color-white);
}

/* ---- Header ---- */
.rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  flex-shrink: 0;
}

.rp-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rp-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
}

.rp-sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-3);
  margin-left: 8px;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:hover {
  background: var(--color-bg-3);
  color: var(--color-text-1);
}

.btn-copy-task {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-success-light);
  background: var(--color-success-lighter);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-success-text);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.btn-copy-task:hover:not(:disabled) {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

.btn-copy-task:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-add-task {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-success-light);
  background: var(--color-success-lighter);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-success-text);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.btn-add-task:hover {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

/* ---- Stats row ---- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.total { background: var(--color-info-light); color: var(--color-info); }
.stat-icon.progress { background: var(--color-warning-light); color: var(--color-warning-text); }
.stat-icon.done { background: var(--color-success-lighter); color: var(--color-success); }

.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-3);
}

/* ---- Rate section ---- */
.rate-section {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px var(--color-shadow);
  flex-shrink: 0;
}

.rate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rate-label {
  font-size: 13px;
  color: var(--color-text-1);
}

.rate-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-success);
}

.rate-bar {
  height: 8px;
  background: var(--color-bg-4);
  border-radius: 999px;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 999px;
  transition: width 0.5s ease;
}

/* ---- Distribution ---- */
.dist-section {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px var(--color-shadow);
  flex-shrink: 0;
}

.dist-title {
  font-size: 13px;
  color: var(--color-text-1);
  margin-bottom: 12px;
}

.dist-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  height: 80px;
  padding-bottom: 4px;
}

.dist-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.dist-bar-wrap {
  width: 100%;
  height: 60px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.dist-bar {
  width: 70%;
  background: var(--color-success);
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
  min-height: 0;
}

.dist-label {
  font-size: 9px;
  color: var(--color-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

.dist-legend {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-bg-4);
  font-size: 11px;
  color: var(--color-text-3);
}

.legend-all { color: var(--color-text-3); }
.legend-done { display: flex; align-items: center; gap: 4px; }
.legend-dot {
  width: 8px;
  height: 8px;
  background: var(--color-success);
  border-radius: 2px;
}

/* ---- Task card (统一) ---- */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px var(--color-shadow);
  transition: all 0.15s;
  cursor: pointer;
  border: 2px solid transparent;
}

.task-card:hover {
  box-shadow: 0 2px 8px var(--color-shadow);
}

.task-card.task-done .tc-title {
  color: var(--color-text-4);
  text-decoration: line-through;
}

.task-card.task-selected {
  border-color: var(--color-success);
  background: var(--color-success-lighter);
}

.tc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tc-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  cursor: pointer;
  line-height: 1.4;
}

.tc-title:hover {
  color: var(--color-text-2);
}

.tc-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.tc-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s;
  color: var(--color-text-3);
}

.tc-btn:hover {
  background: var(--color-bg-4);
}

.tc-btn-copy:hover {
  color: var(--color-success-text);
  background: var(--color-success-lighter);
}

.tc-btn-edit:hover {
  color: var(--color-info);
  background: var(--color-info-light);
}

.tc-btn-delete:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.tc-btn-view:hover {
  color: var(--color-text-2);
  background: var(--color-bg-3);
}

.tc-btn-time {
  color: var(--color-warning-text);
}

.tc-btn-time:hover {
  color: var(--color-warning-text);
  background: var(--color-warning-light);
}

.tc-btn-ai {
  color: var(--color-accent);
}

.tc-btn-ai:hover {
  color: var(--color-accent-text);
  background: var(--color-accent-light);
}

.tc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tc-priority {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.tc-status {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.12s;
}

.tc-status:hover {
  opacity: 0.75;
}

.tc-status-locked {
  cursor: not-allowed;
  opacity: 0.6;
}

.tc-status-locked:hover {
  opacity: 0.6;
}

/* 日期标签 */
.tc-date {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 5px;
  font-weight: 500;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tc-date svg {
  flex-shrink: 0;
}
.tc-date.created {
  background: var(--color-bg-4);
  color: var(--color-text-3);
}
.tc-date.planned {
  background: var(--color-success-lighter);
  color: var(--color-success-text);
}
.tc-date.due {
  background: var(--color-info-light);
  color: var(--color-info);
}
.tc-date.due.overdue {
  background: var(--color-danger-light);
  color: var(--color-danger);
  font-weight: 600;
}

.tc-duration {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 5px;
  font-weight: 500;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  background: var(--color-accent-light);
  color: var(--color-accent-text);
}

/* ---- Detail list ---- */
.detail-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.detail-list-title {
  font-size: 12px;
  color: var(--color-text-2);
}

/* ---- Empty ---- */
.rp-empty {
  text-align: center;
  padding: 32px 0;
  font-size: 13px;
  color: var(--color-text-3);
}

/* Progressive rendering sentinel */
.rp-sentinel {
  height: 1px;
  width: 100%;
}

.rp-body {
  flex: 1;
  min-height: 0;
}

/* ---- Detail popup ---- */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay-md);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  backdrop-filter: blur(2px);
}

.detail-popup {
  width: 440px;
  max-width: 90vw;
  max-height: 70vh;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 20px 60px var(--color-shadow-md);
  overflow-y: auto;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

.detail-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
}

.detail-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.detail-pri {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  line-height: 18px;
}

.detail-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  line-height: 18px;
}

.detail-due {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--color-info-light);
  color: var(--color-info-text);
}

.detail-duration {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--color-accent-light);
  color: var(--color-accent-text);
  font-weight: 500;
}

/* ---- Detail time row ---- */
.detail-time-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

/* 状态选择按钮组 */
.detail-status-row {
  display: flex;
  gap: 6px;
}

.detail-status-btn {
  flex: 1;
  padding: 5px 0;
  border: 1px solid var(--color-border-light);
  border-radius: 7px;
  background: var(--color-bg-4);
  color: var(--color-text-2);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.detail-status-btn:hover {
  background: var(--color-primary-light, var(--color-accent-light));
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.detail-status-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

/* 时间输入行 */
.detail-time-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-time-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-text-1);
  outline: none;
  background: var(--color-surface);
  transition: border-color 0.15s;
}

.detail-time-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.detail-time-sep {
  font-size: 12px;
  color: var(--color-text-3);
  flex-shrink: 0;
}

.detail-time-save {
  padding: 5px 16px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  background: var(--color-primary);
  color: #fff;
  align-self: flex-end;
  transition: opacity 0.15s;
}

.detail-time-save:hover {
  opacity: 0.85;
}

.detail-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-1);
}

.detail-desc :deep(h1) { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
.detail-desc :deep(h2) { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
.detail-desc :deep(h3) { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
.detail-desc :deep(p) { margin: 0 0 6px; }
.detail-desc :deep(ul), .detail-desc :deep(ol) { margin: 0 0 6px; padding-left: 18px; }
.detail-desc :deep(code) { background: var(--color-code-bg); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
.detail-desc :deep(pre) { background: var(--color-pre-bg); color: var(--color-pre-text); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 0 0 6px; }
.detail-desc :deep(pre code) { background: none; padding: 0; color: inherit; }
.detail-desc :deep(blockquote) { border-left: 3px solid var(--color-text-4); padding-left: 10px; color: var(--color-text-2); margin: 0 0 6px; }
.detail-desc :deep(table) { border-collapse: collapse; width: 100%; margin: 0 0 6px; }
.detail-desc :deep(th), .detail-desc :deep(td) { border: 1px solid var(--color-border); padding: 4px 8px; }
.detail-desc :deep(th) { background: var(--color-bg-3); }

.detail-empty {
  color: var(--color-text-3);
  font-style: italic;
}

/* ---- All View (全部任务总览) ---- */
.stats-row-all {
  grid-template-columns: repeat(4, 1fr);
}

.stat-card-todo .stat-num { color: var(--color-warning-text); }
.stat-card-progress .stat-num { color: var(--color-info); }
.stat-card-done .stat-num { color: var(--color-success); }

/* Focus area */
.all-focus-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex-shrink: 0;
}

.all-focus-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.all-focus-danger {
  border-left: 3px solid var(--color-danger);
}

.all-focus-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.all-focus-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
}

.all-focus-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-info-light);
  color: var(--color-info);
}

.all-focus-badge.danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.all-focus-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.all-focus-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--color-bg-2);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.all-focus-item:hover {
  background: var(--color-bg-3);
}

.all-focus-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-info);
  flex-shrink: 0;
}

.all-focus-dot.danger {
  background: var(--color-danger);
}

.all-focus-name {
  font-size: 12px;
  color: var(--color-text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.all-focus-tag {
  font-size: 11px;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
}

.all-focus-tag.danger {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.all-focus-date {
  font-size: 11px;
  color: var(--color-text-3);
  flex-shrink: 0;
}

.all-focus-item .tc-priority {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.all-focus-more {
  font-size: 11px;
  color: var(--color-text-3);
  text-align: center;
  padding-top: 2px;
}

/* Distribution bar */
.all-dist-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.all-dist-seg.todo {
  background: var(--color-warning);
}

.all-dist-seg.progress {
  background: var(--color-info);
}

.all-dist-seg.done {
  background: var(--color-success);
}

.all-dist-legend {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.legend-item {
  font-size: 11px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-item::before {
  content: '';
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-item.todo::before { background: var(--color-warning); }
.legend-item.progress::before { background: var(--color-info); }
.legend-item.done::before { background: var(--color-success); }
</style>
