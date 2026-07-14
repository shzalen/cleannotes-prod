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
    if (t.startDate === todayStr) return true
    if (t.startDate && t.startDate < todayStr && t.status !== 'done') return true
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(todayStr)
      const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr && t.status !== 'done'
      const completedOnDay = t.completedAt && t.completedAt.startsWith(todayStr)
      return createdOnDay || createdBeforeAndUndone || completedOnDay
    }
    if (t.completedAt && t.completedAt.startsWith(todayStr)) return true
    return false
  })
)

// ── 排序 ──
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

const rate = computed(() => {
  const total = sortedTasks.value.length
  if (total === 0) return 0
  const doneCount = sortedTasks.value.filter(t => t.status === 'done').length
  return Math.round((doneCount / total) * 100)
})

function formatDate(dateStr: string) { return dateStr.slice(5, 10) }

function timeLabel(task: Task) {
  if (task.status === 'done') return task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : ''
  return task.startTime || '--:--'
}

function showDueDate(task: Task) {
  if (!task.dueDate) return false
  if (task.status !== 'done') return true
  return task.dueDate < today.value
}

function isOverdue(task: Task) { return !!task.dueDate && task.dueDate < today.value }

function showPlannedDate(task: Task) {
  if (task.status !== 'done') return false
  if (!task.completedAt?.startsWith(today.value)) return false
  const sd = task.startDate || task.createdAt.slice(0, 10)
  return sd !== today.value
}

function isFutureTask(task: Task) {
  if (task.startDate) return task.startDate > today.value
  return task.createdAt.slice(0, 10) > today.value
}

function isTimeReached(task: Task) {
  if (!task.startTime || task.status === 'done') return false
  const dateToCheck = task.startDate ?? task.createdAt.slice(0, 10)
  if (dateToCheck > today.value) return false
  if (dateToCheck < today.value) return true
  const cm = now.value.getHours() * 60 + now.value.getMinutes()
  const [h, m] = task.startTime.split(':').map(Number)
  return cm >= h * 60 + m
}

const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }

const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}))

const priorityLabelMap: Record<TaskPriority, string> = { high: '高', medium: '中', low: '低' }

// ── 橡皮筋效果（下拉刷新 + 底部弹性） ──
const scrollEl = ref<HTMLElement | null>(null)
const bounceOffset = ref(0)        // translateY 偏移
const bounceActive = ref(false)    // 是否正在橡皮筋
const refreshing = ref(false)
const touchStartY = ref(0)
const touchStartScrollTop = ref(0)
const isAtTop = ref(false)         // 触摸开始时是否在顶部
const isAtBottom = ref(false)      // 触摸开始时是否在底部

function onTouchStart(e: TouchEvent) {
  const el = scrollEl.value
  if (!el || refreshing.value) return
  touchStartY.value = e.touches[0].clientY
  touchStartScrollTop.value = el.scrollTop
  isAtTop.value = el.scrollTop <= 0
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
}

function onTouchMove(e: TouchEvent) {
  const el = scrollEl.value
  if (!el || refreshing.value) return
  const dy = e.touches[0].clientY - touchStartY.value

  // 下拉橡皮筋（在顶部继续下拉）
  if (isAtTop.value && dy > 0 && el.scrollTop <= 0) {
    bounceActive.value = true
    // 阻尼曲线：越大越难拉
    bounceOffset.value = Math.min(dy, 160) * 0.35
    if (e.cancelable) e.preventDefault()
    return
  }

  // 上拉橡皮筋（在底部继续上拉）
  if (isAtBottom.value && dy < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
    bounceActive.value = true
    bounceOffset.value = Math.max(dy, -160) * 0.35
    if (e.cancelable) e.preventDefault()
    return
  }

  bounceActive.value = false
  bounceOffset.value = 0
}

async function onTouchEnd() {
  if (refreshing.value) return

  if (bounceActive.value && bounceOffset.value >= 40 && isAtTop.value) {
    // 触发刷新
    refreshing.value = true
    bounceOffset.value = 40
    try {
      await store.load(true)
      now.value = new Date()
    } finally {
      refreshing.value = false
      bounceOffset.value = 0
      bounceActive.value = false
    }
    return
  }

  // 弹性回弹
  bounceActive.value = false
  bounceOffset.value = 0
}

// ── 弹窗 ──
const detailSheet = ref<InstanceType<typeof TaskDetailSheet> | null>(null)
const progressSheet = ref<InstanceType<typeof TaskProgressSheet> | null>(null)

function showDetail(task: Task) { detailSheet.value?.open(task) }
function openProgress(task: Task) { if (!isFutureTask(task)) progressSheet.value?.open(task) }
</script>

<template>
  <div class="home-page">
    <!-- Status bar + Header (extends to top safe area) -->
    <div class="home-header">
      <div class="header-content">
        <h1 class="header-title">清记</h1>
        <p class="header-date">{{ dateDisplay }}</p>
      </div>
    </div>

    <!-- Scrollable content -->
    <div
      ref="scrollEl"
      class="home-scroll"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div
        class="scroll-wrapper"
        :style="{
          transform: `translateY(${bounceOffset}px)`,
          transition: bounceActive || refreshing ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)'
        }"
      >
        <!-- Pull-refresh indicator -->
        <div class="pull-indicator" :style="{ height: bounceOffset > 0 && isAtTop ? bounceOffset + 'px' : '0px', opacity: Math.min(bounceOffset / 40, 1) }">
          <span v-if="!refreshing && bounceOffset > 0" class="pull-text">{{ bounceOffset >= 40 ? '松开刷新' : '下拉刷新' }}</span>
          <span v-else-if="refreshing" class="pull-spinner" />
        </div>

        <div class="content-area">
        <!-- Progress Card -->
        <div class="progress-card">
          <div class="progress-top">
            <span class="progress-label">今日完成率</span>
            <span class="progress-value">{{ rate }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: rate + '%' }" />
          </div>
        </div>

        <!-- Timeline -->
        <div v-if="sortedTasks.length" class="timeline">
          <div
            v-for="task in sortedTasks"
            :key="task.id"
            class="tl-item"
            :class="{ 'is-done': task.status === 'done' }"
          >
            <div
              class="tl-dot"
              :class="[task.status, { clickable: task.status !== 'done' && !isFutureTask(task), 'is-due': isTimeReached(task) && task.status !== 'todo', 'is-due-urgent': isTimeReached(task) && task.status === 'todo' }]"
              @click="openProgress(task)"
            />
            <span class="tl-time" :class="task.status">{{ timeLabel(task) }}</span>
            <div class="tl-main" @click="showDetail(task)">
              <span class="tl-title" :class="task.status">{{ task.title }}</span>
              <div class="tl-meta">
                <span v-if="showDueDate(task)" class="tl-tag due" :class="{ overdue: isOverdue(task) }">
                  {{ isOverdue(task) ? `延期 ${formatDate(task.dueDate!)}` : `截止 ${formatDate(task.dueDate!)}` }}
                </span>
                <span v-if="showPlannedDate(task)" class="tl-tag planned">
                  计划 {{ formatDate(task.startDate || task.createdAt.slice(0, 10)) }}
                </span>
                <span class="tl-tag pri" :class="task.priority">{{ priorityLabelMap[task.priority] }}</span>
              </div>
            </div>
            <span
              v-if="task.status !== 'done'"
              class="tl-status"
              :class="[task.status, { locked: isFutureTask(task) }]"
              @click="openProgress(task)"
            >{{ statusLabel[task.status] }}</span>
          </div>
        </div>
        <div v-else class="empty-state">今日暂无任务</div>
      </div>
      </div> <!-- .scroll-wrapper -->
    </div>

    <TaskDetailSheet ref="detailSheet" />
    <TaskProgressSheet ref="progressSheet" />
  </div>
</template>

<style scoped>
.home-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header (with safe-area background) ── */
.home-header {
  background: var(--color-primary);
  /* 确保状态栏背景：safe-area-inset-top 可能为0，用 min-height 保证 */
  padding-top: max(env(safe-area-inset-top, 0px), 20px);
  padding-bottom: 20px;
  flex-shrink: 0;
}

.header-content {
  padding: 8px 20px 0;
}

.header-title {
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
}

.header-date {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 2px;
}

/* ── Scroll ── */
.home-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.scroll-wrapper {
  min-height: 100%;
}

/* ── Pull Refresh ── */
.pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.pull-text {
  font-size: 13px;
  color: var(--color-text-3);
}

.pull-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Content ── */
.content-area {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

/* ── Progress ── */
.progress-card {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px var(--color-shadow);
  margin-bottom: 18px;
}

.progress-top {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}

.progress-label { font-size: 15px; font-weight: 500; color: var(--color-text-2); }
.progress-value { font-size: 16px; font-weight: 700; color: var(--color-primary); }

.progress-track {
  height: 6px; background: var(--color-bg-4); border-radius: 3px; overflow: hidden;
}

.progress-fill {
  height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.5s ease;
}

/* ── Timeline ── */
.timeline { position: relative; padding-left: 24px; }
.timeline::before {
  content: ''; position: absolute; left: 10px; top: 4px; bottom: 4px;
  width: 1px; background: var(--color-border);
}

.tl-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: var(--color-surface); margin-bottom: 6px; position: relative;
  box-shadow: 0 1px 2px var(--color-shadow);
}

.tl-item:active { background: var(--color-bg-2); }
.tl-item.is-done { opacity: 0.6; }

.tl-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  position: absolute; left: -19px; top: 16px; transform: translateY(-50%);
  z-index: 1; box-shadow: 0 0 0 3px var(--color-surface);
}

.tl-dot.todo { background: var(--color-text-4); border: 1.5px solid var(--color-border); }
.tl-dot.in_progress { background: var(--color-warning); border: 1.5px solid var(--color-warning); }
.tl-dot.done { background: var(--color-primary); }
.tl-dot.clickable { cursor: pointer; }
.tl-dot.clickable:active { transform: translateY(-50%) scale(1.4); }

.tl-time {
  font-size: 13px; font-weight: 600; color: var(--color-text-2);
  width: 40px; flex-shrink: 0; padding-top: 2px; font-variant-numeric: tabular-nums;
}

.tl-time.done { font-size: 11px; font-weight: 400; color: var(--color-text-4); }
.tl-time:empty::after { content: '--:--'; color: var(--color-text-4); font-weight: 400; font-size: 11px; }

.tl-main { flex: 1; min-width: 0; cursor: pointer; }

.tl-title {
  font-size: 15px; font-weight: 500; color: var(--color-text-1);
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.tl-title.done { text-decoration: line-through; color: var(--color-text-3); }

.tl-meta { display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }

.tl-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 500; white-space: nowrap;
}

.tl-tag.due { background: var(--color-info-light); color: var(--color-info); }
.tl-tag.due.overdue { background: var(--color-danger-light); color: var(--color-danger); font-weight: 600; }
.tl-tag.planned { background: var(--color-success-lighter); color: var(--color-primary); }
.tl-tag.pri.high { background: var(--color-danger-light); color: var(--color-danger); }
.tl-tag.pri.medium { background: var(--color-info-light); color: var(--color-info); }
.tl-tag.pri.low { background: var(--color-success-lighter); color: var(--color-primary); }

.tl-status {
  font-size: 11px; padding: 3px 8px; border-radius: 5px; font-weight: 500;
  flex-shrink: 0; cursor: pointer; align-self: center;
}

.tl-status.todo { background: var(--color-bg-2); color: var(--color-text-2); }
.tl-status.in_progress { background: var(--color-warning-light); color: var(--color-warning-text); }
.tl-status:active { opacity: 0.6; }
.tl-status.locked { cursor: not-allowed; opacity: 0.4; }

.empty-state { text-align: center; color: var(--color-text-3); font-size: 14px; padding: 48px 0; }
</style>
