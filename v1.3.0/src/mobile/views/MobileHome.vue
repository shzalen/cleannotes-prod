<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { Task, TaskPriority } from '@/types'
import TaskDetailSheet from '@/mobile/components/TaskDetailSheet.vue'
import TaskProgressSheet from '@/mobile/components/TaskProgressSheet.vue'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()

// ── 定时刷新 ──
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const today = computed(() => toLocalDate(now.value))

// ── 日期格式化 ──
const dateDisplay = computed(() => {
  const d = now.value
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${weekDays[d.getDay()]}`
})

// ── 今日任务过滤（完全对齐 PC 端 TodayProgress.vue） ──
const todayTasks = computed(() =>
  store.tasks.filter(t => {
    const todayStr = today.value
    // 1. 计划任务
    if (t.startDate === todayStr) return true
    // 2. 延迟任务
    if (t.startDate && t.startDate < todayStr && t.status !== 'done') return true
    // 3. 无开始日期回退
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(todayStr)
      const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr && t.status !== 'done'
      const completedOnDay = t.completedAt && t.completedAt.startsWith(todayStr)
      return createdOnDay || createdBeforeAndUndone || completedOnDay
    }
    // 4. 今天完成的追溯
    if (t.completedAt && t.completedAt.startsWith(todayStr)) return true
    return false
  })
)

// ── 排序（对齐 PC 端） ──
const sortedTasks = computed(() => {
  const active: Task[] = []
  const done: Task[] = []
  for (const t of todayTasks.value) {
    if (t.status === 'done') done.push(t)
    else active.push(t)
  }
  active.sort((a, b) => {
    if (a.startDate && b.startDate) {
      const dc = a.startDate.localeCompare(b.startDate)
      if (dc !== 0) return dc
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
    }
    if (a.startDate && !b.startDate) return -1
    if (!a.startDate && b.startDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  return [...active, ...done]
})

// ── 完成率 ──
const rate = computed(() => {
  const total = sortedTasks.value.length
  if (total === 0) return 0
  const doneCount = sortedTasks.value.filter(t => t.status === 'done').length
  return Math.round((doneCount / total) * 100)
})

// ── 辅助函数 ──
function formatDate(dateStr: string) {
  return dateStr.slice(5, 10)
}

function timeLabel(task: Task) {
  if (task.status === 'done') {
    return task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : ''
  }
  return task.startTime || '--:--'
}

function isFutureTask(task: Task) {
  if (task.startDate) return task.startDate > today.value
  return task.createdAt.slice(0, 10) > today.value
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
  high: '高', medium: '中', low: '低',
}

// ── 弹窗 ──
const detailSheet = ref<InstanceType<typeof TaskDetailSheet> | null>(null)
const progressSheet = ref<InstanceType<typeof TaskProgressSheet> | null>(null)

function showDetail(task: Task) {
  detailSheet.value?.open(task)
}

function openProgress(task: Task) {
  if (isFutureTask(task)) return
  progressSheet.value?.open(task)
}
</script>

<template>
  <div class="home-page">
    <!-- Immersive Header -->
    <div class="home-header safe-top">
      <div class="header-content">
        <h1 class="header-title">清记</h1>
        <p class="header-date">{{ dateDisplay }}</p>
      </div>
    </div>

    <!-- Progress Card -->
    <div class="content-area">
      <div class="progress-card">
        <div class="progress-top">
          <span class="progress-label">今日完成率</span>
          <span class="progress-value">{{ rate }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: rate + '%' }" />
        </div>
      </div>

      <!-- Task List -->
      <div v-if="sortedTasks.length" class="task-list">
        <div
          v-for="task in sortedTasks"
          :key="task.id"
          class="task-row"
          :class="{ 'is-done': task.status === 'done' }"
        >
          <div
            class="task-dot"
            :class="[task.status, { clickable: task.status !== 'done' && !isFutureTask(task) }]"
            :style="{ '--dot-color': priorityColorMap[task.priority] }"
            @click="openProgress(task)"
          />
          <span class="task-time" :class="task.status">{{ timeLabel(task) }}</span>
          <div class="task-main" @click="showDetail(task)">
            <span class="task-title" :class="task.status">{{ task.title }}</span>
            <div class="task-meta">
              <span class="meta-pri" :class="task.priority">{{ priorityLabelMap[task.priority] }}</span>
            </div>
          </div>
          <span
            v-if="task.status !== 'done'"
            class="task-status-tag"
            :class="[task.status, { locked: isFutureTask(task) }]"
            @click="openProgress(task)"
          >{{ statusLabel[task.status] }}</span>
        </div>
      </div>
      <div v-else class="empty-state">今日暂无任务</div>
    </div>

    <TaskDetailSheet ref="detailSheet" />
    <TaskProgressSheet ref="progressSheet" />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── Immersive Header ── */
.home-header {
  background: var(--color-primary);
  padding-bottom: 20px;
}

.header-content {
  padding: 0 20px;
  padding-top: 12px;
}

.header-title {
  font-size: 28px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
}

.header-date {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 2px;
}

/* ── Content ── */
.content-area {
  flex: 1;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

/* ── Progress Card ── */
.progress-card {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px var(--color-shadow);
  margin-bottom: 16px;
}

.progress-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-2);
}

.progress-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}

.progress-track {
  height: 6px;
  background: var(--color-bg-4);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* ── Task List ── */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface);
  transition: background 0.15s;
}

.task-row:active {
  background: var(--color-bg-2);
}

.task-row.is-done {
  opacity: 0.6;
}

.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-text-4);
}

.task-dot.todo {
  background: var(--color-text-4);
  border: 1.5px solid var(--color-border);
}

.task-dot.in_progress {
  background: var(--color-warning);
  border: 1.5px solid var(--color-warning);
}

.task-dot.done {
  background: var(--color-primary);
}

.task-dot.clickable {
  cursor: pointer;
}

.task-dot.clickable:active {
  transform: scale(1.3);
}

.task-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  width: 36px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.task-time.done {
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-4);
}

.task-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--color-text-3);
}

.task-meta {
  display: flex;
  flex-shrink: 0;
}

.meta-pri {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-pri.high {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.meta-pri.medium {
  background: var(--color-info-light);
  color: var(--color-info);
}

.meta-pri.low {
  background: var(--color-success-lighter);
  color: var(--color-primary);
}

.task-status-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 5px;
  font-weight: 500;
  flex-shrink: 0;
  cursor: pointer;
}

.task-status-tag.todo {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.task-status-tag.in_progress {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.task-status-tag:active {
  opacity: 0.6;
}

.task-status-tag.locked {
  cursor: not-allowed;
  opacity: 0.4;
}

/* ── Empty ── */
.empty-state {
  text-align: center;
  color: var(--color-text-3);
  font-size: 14px;
  padding: 48px 0;
}
</style>
