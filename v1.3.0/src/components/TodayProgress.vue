<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useTaskStore } from '@/stores/task'
import type { Task, TaskPriority } from '@/types'
import { toLocalDate } from '@/utils/time'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskDetailModal from '@/components/TaskDetailModal.vue'
import TaskProgressModal from '@/components/TaskProgressModal.vue'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()
const props = defineProps<{ rate: number }>()

// 定时刷新：确保 today / isTimeReached / 到点脉冲随时间自动更新
const now = ref(new Date())
let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshTimer = setInterval(() => { now.value = new Date() }, 30_000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const today = computed(() => toLocalDate(now.value))

// 今日任务过滤
const todayTasks = computed(() =>
  store.tasks.filter(t => {
    const todayStr = today.value
    // 1. 开始日期为当天 → 计划任务
    if (t.startDate === todayStr) return true
    // 2. 开始日期早于当天且未完成 → 延迟任务
    if (t.startDate && t.startDate < todayStr && t.status !== 'done') return true
    // 3. 无开始日期（旧数据/未规划）→ 回退到 createdAt 逻辑
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(todayStr)
      const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr && t.status !== 'done'
      const completedOnDay = t.completedAt && t.completedAt.startsWith(todayStr)
      return createdOnDay || createdBeforeAndUndone || completedOnDay
    }
    // 4. 今天完成的任务（无论开始日期是什么，方便追溯）
    if (t.completedAt && t.completedAt.startsWith(todayStr)) return true
    return false
  })
)

// ---- 统一排序 ----
// 1. 未完成 → startDate 升序（有开始日期优先），再按 startTime 升序
//    无开始日期的任务排在后面，按 createdAt 降序（最新创建的在前）
// 2. 已完成 → completedAt 降序，统一排在最后
const sortedTasks = computed(() => {
  const active: Task[] = []
  const done: Task[] = []
  for (const t of todayTasks.value) {
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
})

// ---- 辅助函数 ----
function showDueDate(task: Task) {
  if (!task.dueDate) return false
  // 未完成：始终显示截止日期
  if (task.status !== 'done') return true
  // 已完成：仅当截止日期已过（延期完成）时显示
  return task.dueDate < today.value
}

function isOverdue(task: Task) {
  return !!task.dueDate && task.dueDate < today.value
}

/** 今天完成的任务且开始日期不是今天 → 显示原定开始日期 */
function showPlannedDate(task: Task) {
  if (task.status !== 'done') return false
  if (!task.completedAt?.startsWith(today.value)) return false
  const sd = task.startDate || task.createdAt.slice(0, 10)
  return sd !== today.value
}

function formatDate(dateStr: string) {
  return dateStr.slice(5, 10)
}

function timeLabel(task: Task) {
  if (task.status === 'done') {
    return task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : ''
  }
  return task.startTime || '--:--'
}

const statusLabel: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
}

const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}))

const priorityLabelMap: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

// ---- TaskEditModal ----
const modalRef = ref<InstanceType<typeof TaskEditModal> | null>(null)

// ---- TaskDetailModal ----
const detailModalRef = ref<InstanceType<typeof TaskDetailModal> | null>(null)

// ---- TaskProgressModal ----
const progressModalRef = ref<InstanceType<typeof TaskProgressModal> | null>(null)

function showDetail(task: Task) {
  detailModalRef.value?.open(task)
}

function openEdit(task: Task) {
  modalRef.value?.openEdit(task)
}

/** 点击小圆点/状态徽标：弹出进度更新弹窗（默认下一状态 + 实际开始时间默认当前时间） */
function openProgress(task: Task) {
  if (isFutureTask(task)) return
  progressModalRef.value?.open(task)
}

function isFutureTask(task: Task) {
  if (task.startDate) return task.startDate > today.value
  // 无 startDate 时回退到 createdAt 逻辑（旧数据兼容）
  return task.createdAt.slice(0, 10) > today.value
}

/** 当前时间是否已到达/超过任务的 startTime（含跨天延迟任务） */
function isTimeReached(task: Task) {
  if (!task.startTime || task.status === 'done') return false
  const dateToCheck = task.startDate ?? task.createdAt.slice(0, 10)
  // startDate 必须 <= 今天（包含今日及历史拖延任务），未来任务不触发
  if (dateToCheck > today.value) return false
  // startDate 早于今天：已整体逾期，直接视为"时间已到"
  if (dateToCheck < today.value) return true
  // startDate == 今天：精确比较当前时间与 startTime
  const currentMinutes = now.value.getHours() * 60 + now.value.getMinutes()
  const [h, m] = task.startTime.split(':').map(Number)
  const taskMinutes = h * 60 + m
  return currentMinutes >= taskMinutes
}
</script>

<template>
  <div class="progress-card">
    <div class="progress-header">
      <span class="progress-label">今日完成率</span>
      <span class="progress-value">{{ rate }}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: rate + '%' }" />
    </div>

    <!-- 今日任务时间轴 -->
    <div v-if="sortedTasks.length" class="timeline">
      <div
        v-for="task in sortedTasks"
        :key="task.id"
        class="timeline-item"
        :class="{ 'is-done': task.status === 'done' }"
        :style="{ '--pri-color': priorityColorMap[task.priority] }"
      >
        <div
          class="timeline-dot"
          :class="[task.status, { clickable: task.status !== 'done' && !isFutureTask(task), 'is-due': isTimeReached(task) && task.status !== 'todo', 'is-due-urgent': isTimeReached(task) && task.status === 'todo' }]"
          @click="task.status !== 'done' && !isFutureTask(task) && openProgress(task)"
        />
        <span class="timeline-time" :class="task.status">
          {{ timeLabel(task) }}
        </span>
        <div class="timeline-content">
          <span :class="['timeline-title', task.status]" @click="showDetail(task)">
            {{ task.title }}
          </span>
          <div class="timeline-meta">
            <span
              v-if="showDueDate(task)"
              :class="['meta-tag', 'due', { overdue: isOverdue(task) }]"
            >
              <template v-if="isOverdue(task)">延期 {{ formatDate(task.dueDate!) }}</template>
              <template v-else>截止 {{ formatDate(task.dueDate!) }}</template>
            </span>
            <span
              v-if="showPlannedDate(task)"
              class="meta-tag planned"
            >
              计划 {{ formatDate(task.startDate || task.createdAt.slice(0, 10)) }}
            </span>
            <span class="meta-tag pri" :class="task.priority">
              {{ priorityLabelMap[task.priority] }}
            </span>
          </div>
        </div>
        <span
          v-if="task.status !== 'done'"
          :class="['timeline-status', task.status, { locked: isFutureTask(task) }]"
          @click="!isFutureTask(task) && openProgress(task)"
        >{{ statusLabel[task.status] }}</span>
      </div>
    </div>
    <div v-else class="today-empty">今日暂无任务</div>

    <TaskEditModal ref="modalRef" />
    <TaskDetailModal ref="detailModalRef" @edit="openEdit" />
    <TaskProgressModal ref="progressModalRef" />
  </div>
</template>

<style scoped>
.progress-card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 18px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success-text);
}

.progress-track {
  height: 6px;
  background: var(--color-bg-4);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 999px;
  transition: width 0.5s ease;
}

/* ===== 时间轴 ===== */
.timeline {
  margin-top: 14px;
  position: relative;
  padding-left: 24px;
}

/* 时间轴纵向线 */
.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 4px;
  bottom: 4px;
  width: 1px;
  background: var(--color-border);
}

/* 条目 */
.timeline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  position: relative;
  transition: background 0.15s;
}

.timeline-item:hover {
  background: var(--color-bg-3);
}

.timeline-item.is-done {
  opacity: 0.65;
}

.timeline-item.is-done:hover {
  opacity: 0.85;
}

/* 圆点 */
.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  position: absolute;
  left: -18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  box-shadow: 0 0 0 3px var(--color-surface);
}

.timeline-dot.todo {
  background: var(--color-text-4);
  border: 1.5px solid var(--color-border);
}

.timeline-dot.in_progress {
  background: var(--color-warning);
  border: 1.5px solid var(--color-warning-text);
}

.timeline-dot.done {
  background: var(--color-success);
  border: 1.5px solid var(--color-success-text);
}

.timeline-dot.clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.timeline-dot.clickable:hover {
  transform: translateY(-50%) scale(1.4);
  box-shadow: 0 0 0 5px var(--color-surface);
}

/* 到点脉冲光环 */
.timeline-dot.is-due::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: transparent;
  border: 1.5px solid var(--color-warning);
  animation: dot-pulse 1.2s ease-out infinite;
  pointer-events: none;
}

@keyframes dot-pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* 到点脉冲光环 — 待办（紧急加速） */
.timeline-dot.is-due-urgent::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: transparent;
  border: 1.5px solid var(--color-warning);
  animation: dot-pulse-urgent 0.65s ease-out infinite;
  pointer-events: none;
}

@keyframes dot-pulse-urgent {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* 时间文字 */
.timeline-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  width: 40px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.timeline-time.todo,
.timeline-time.in_progress {
  color: var(--color-text-2);
}

.timeline-time.done {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-4);
}

/* 无时间占位 */
.timeline-time:empty::after {
  content: '--:--';
  color: var(--color-text-4);
  font-weight: 400;
  font-size: 11px;
}

/* 内容 */
.timeline-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.timeline-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color 0.12s;
}

.timeline-title:hover {
  color: var(--color-primary);
}

.timeline-title.done {
  text-decoration: line-through;
  color: var(--color-text-3);
  cursor: default;
}

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.meta-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.meta-tag.due {
  background: var(--color-info-light);
  color: var(--color-info);
}

.meta-tag.due.overdue {
  background: var(--color-danger-light);
  color: var(--color-danger);
  font-weight: 600;
}

.meta-tag.planned {
  background: var(--color-success-lighter);
  color: var(--color-success-text);
}

.meta-tag.pri.high {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.meta-tag.pri.medium {
  background: var(--color-info-light);
  color: var(--color-info);
}

.meta-tag.pri.low {
  background: var(--color-success-lighter);
  color: var(--color-success);
}

/* 状态按钮 */
.timeline-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.12s;
}

.timeline-status:hover { opacity: 0.7; }

.timeline-status.todo {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.timeline-status.in_progress {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.timeline-status.locked {
  cursor: not-allowed;
  opacity: 0.4;
}

.timeline-status.locked:hover {
  opacity: 0.4;
}

.today-empty {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-3);
  padding: 24px 0;
}
</style>
