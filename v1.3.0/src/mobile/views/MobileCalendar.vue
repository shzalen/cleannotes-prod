<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import TaskDetailSheet from '@/mobile/components/TaskDetailSheet.vue'
import TaskCreateSheet from '@/mobile/components/TaskCreateSheet.vue'

const store = useTaskStore()

const now = new Date()
const todayStr = toLocalDate(now)
const selectedDate = ref(todayStr)

// ── 当前周基准日期（以周为单位偏移） ──
const weekBase = ref(getMonday(new Date()))

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// ── 本周 7 天 ──
const weekDays = computed(() => {
  const days: { date: Date; dateStr: string; dayName: string; dayNum: number; isToday: boolean; hasTasks: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekBase.value)
    d.setDate(d.getDate() + i)
    const ds = toLocalDate(d)
    days.push({
      date: d, dateStr: ds,
      dayName: ['一', '二', '三', '四', '五', '六', '日'][i],
      dayNum: d.getDate(),
      isToday: ds === todayStr,
      hasTasks: store.tasks.some(t => {
        const sd = t.startDate || t.createdAt.slice(0, 10)
        return sd === ds
      }),
    })
  }
  return days
})

const weekLabel = computed(() => {
  const s = weekBase.value
  const e = new Date(s); e.setDate(e.getDate() + 6)
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`
})

// ── Touch 无限衔接滚动 ──
const swipeStartX = ref(0)
const swipeDeltaX = ref(0)
const isSwiping = ref(false)

function onTouchStart(e: TouchEvent) {
  swipeStartX.value = e.touches[0].clientX
  swipeDeltaX.value = 0
  isSwiping.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isSwiping.value) return
  swipeDeltaX.value = e.touches[0].clientX - swipeStartX.value
}

function onTouchEnd() {
  if (!isSwiping.value) return
  isSwiping.value = false
  const threshold = 80
  if (Math.abs(swipeDeltaX.value) >= threshold) {
    // 计算需要偏移多少周
    const weeks = Math.round(Math.abs(swipeDeltaX.value) / threshold)
    const dir = swipeDeltaX.value > 0 ? -weeks : weeks
    const newBase = new Date(weekBase.value)
    newBase.setDate(newBase.getDate() + dir * 7)
    weekBase.value = newBase
  }
  swipeDeltaX.value = 0
}

function prevWeek() {
  const d = new Date(weekBase.value)
  d.setDate(d.getDate() - 7)
  weekBase.value = d
}

function nextWeek() {
  const d = new Date(weekBase.value)
  d.setDate(d.getDate() + 7)
  weekBase.value = d
}

// ── 选中日期任务 ──
const dayTasks = computed(() =>
  store.tasks.filter(t => {
    const sd = t.startDate || t.createdAt.slice(0, 10)
    if (sd === selectedDate.value) return true
    if (t.completedAt && t.completedAt.startsWith(selectedDate.value)) return true
    return false
  }).sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
  })
)

function selectDate(ds: string) { selectedDate.value = ds }

function timeLabel(task: Task) {
  if (task.status === 'done') return task.completedAt?.slice(11, 16) || ''
  return task.startTime || '--:--'
}

const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }

// ── 下拉刷新 ──
const scrollEl = ref<HTMLElement | null>(null)
const pullDistance = ref(0)
const pullStartY = ref(0)
const isPulling = ref(false)
const refreshing = ref(false)

function onScrollTouchStart(e: TouchEvent) {
  if (!scrollEl.value || scrollEl.value.scrollTop > 0) return
  pullStartY.value = e.touches[0].clientY
  isPulling.value = true
}

function onScrollTouchMove(e: TouchEvent) {
  if (!isPulling.value || refreshing.value) return
  const dy = e.touches[0].clientY - pullStartY.value
  if (dy <= 0) { pullDistance.value = 0; return }
  pullDistance.value = Math.min(dy * 0.4, 60)
}

async function onScrollTouchEnd() {
  if (!isPulling.value) return
  isPulling.value = false
  if (pullDistance.value >= 40 && !refreshing.value) {
    refreshing.value = true
    pullDistance.value = 40
    try {
      await store.load(true)
    } finally {
      refreshing.value = false
      pullDistance.value = 0
    }
  } else {
    pullDistance.value = 0
  }
}

// ── 弹窗 ──
const detailSheet = ref<InstanceType<typeof TaskDetailSheet> | null>(null)
const createSheet = ref<InstanceType<typeof TaskCreateSheet> | null>(null)

function showDetail(task: Task) { detailSheet.value?.open(task) }
function openCreate() { createSheet.value?.open(selectedDate.value) }
</script>

<template>
  <div class="cal-page">
    <!-- Header -->
    <div class="cal-header safe-top">
      <div class="cal-header-row">
        <div class="cal-header-spacer" />
        <h1 class="cal-title">日历</h1>
        <button class="cal-add-btn" @click="openCreate">新增</button>
      </div>
    </div>

    <!-- Week Strip with infinite swipe -->
    <div
      class="week-strip"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <button class="week-arrow" @click="prevWeek">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18L9 12L15 6"/></svg>
      </button>

      <div
        class="week-days"
        :style="{
          transform: `translateX(${isSwiping ? swipeDeltaX : 0}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }"
      >
        <button
          v-for="d in weekDays"
          :key="d.dateStr"
          class="day-cell"
          :class="{ today: d.isToday, selected: selectedDate === d.dateStr }"
          @click="selectDate(d.dateStr)"
        >
          <span class="day-name">{{ d.dayName }}</span>
          <span class="day-num">{{ d.dayNum }}</span>
          <span v-if="d.hasTasks" class="day-dot" />
        </button>
      </div>

      <button class="week-arrow" @click="nextWeek">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18L15 12L9 6"/></svg>
      </button>
    </div>

    <div class="week-label-text">{{ weekLabel }}</div>

    <!-- Task List with pull-refresh -->
    <div
      ref="scrollEl"
      class="cal-scroll"
      @touchstart.passive="onScrollTouchStart"
      @touchmove.passive="onScrollTouchMove"
      @touchend="onScrollTouchEnd"
    >
      <div class="pull-indicator" :style="{ height: pullDistance + 'px', opacity: pullDistance / 40 }">
        <span v-if="!refreshing" class="pull-text">{{ pullDistance >= 40 ? '松开刷新' : '下拉刷新' }}</span>
        <span v-else class="pull-spinner" />
      </div>

      <div v-if="dayTasks.length" class="task-list">
        <div
          v-for="task in dayTasks"
          :key="task.id"
          class="task-row"
          :class="{ 'is-done': task.status === 'done' }"
          @click="showDetail(task)"
        >
          <span class="task-time" :class="task.status">{{ timeLabel(task) }}</span>
          <span class="task-title" :class="task.status">{{ task.title }}</span>
          <span v-if="task.status !== 'done'" class="task-stag" :class="task.status">{{ statusLabel[task.status] }}</span>
        </div>
      </div>
      <div v-else class="empty-state">当天暂无任务</div>
    </div>

    <TaskDetailSheet ref="detailSheet" />
    <TaskCreateSheet ref="createSheet" />
  </div>
</template>

<style scoped>
.cal-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-0);
}

.cal-header {
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-separator);
  padding-bottom: 8px;
  flex-shrink: 0;
}

.cal-header-row {
  display: flex; align-items: center; padding: 12px 16px 8px;
}

.cal-header-spacer { width: 52px; flex-shrink: 0; }

.cal-title {
  flex: 1; text-align: center; font-size: 17px; font-weight: 600; color: var(--color-text-1);
}

.cal-add-btn {
  width: 52px; text-align: right; background: none; border: none;
  font-size: 15px; font-weight: 500; color: var(--color-primary); cursor: pointer; flex-shrink: 0;
}

.cal-add-btn:active { opacity: 0.6; }

/* ── Week Strip ── */
.week-strip {
  display: flex; align-items: center; padding: 8px 4px;
  background: var(--color-surface); flex-shrink: 0;
  overflow: hidden; touch-action: pan-y;
}

.week-arrow {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--color-text-3); cursor: pointer; flex-shrink: 0;
}

.week-arrow:active { opacity: 0.5; }

.week-days {
  flex: 1; display: flex; justify-content: space-around; will-change: transform;
}

.day-cell {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 6px 0; border: none; background: none; cursor: pointer;
  position: relative; border-radius: 12px; width: 42px;
  -webkit-tap-highlight-color: transparent;
}

.day-cell:active { opacity: 0.6; }

.day-name { font-size: 11px; color: var(--color-text-3); font-weight: 500; }

.day-num {
  font-size: 16px; font-weight: 500; color: var(--color-text-1);
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;
}

.day-cell.today .day-num { background: var(--color-primary); color: #fff; font-weight: 700; }
.day-cell.selected:not(.today) .day-num { border: 2px solid var(--color-primary); color: var(--color-primary); font-weight: 600; }
.day-cell.today .day-name { color: var(--color-primary); font-weight: 600; }

.day-dot {
  width: 4px; height: 4px; border-radius: 50%; background: var(--color-primary); position: absolute; bottom: 0;
}

.week-label-text {
  text-align: center; font-size: 12px; color: var(--color-text-3);
  padding: 6px 0; background: var(--color-surface); flex-shrink: 0;
}

/* ── Scroll ── */
.cal-scroll {
  flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch;
  padding: 8px 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.pull-indicator {
  display: flex; align-items: center; justify-content: center; overflow: hidden; transition: height 0.15s;
}

.pull-text { font-size: 13px; color: var(--color-text-3); }

.pull-spinner {
  width: 20px; height: 20px; border: 2px solid var(--color-border);
  border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Task List ── */
.task-list { display: flex; flex-direction: column; gap: 2px; }

.task-row {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  border-radius: 10px; background: var(--color-surface); cursor: pointer;
}

.task-row:active { background: var(--color-bg-2); }
.task-row.is-done { opacity: 0.6; }

.task-time {
  font-size: 12px; font-weight: 600; color: var(--color-text-2);
  width: 36px; flex-shrink: 0; font-variant-numeric: tabular-nums;
}

.task-time.done { font-size: 10px; font-weight: 400; color: var(--color-text-4); }

.task-title {
  flex: 1; font-size: 14px; font-weight: 500; color: var(--color-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.task-title.done { text-decoration: line-through; color: var(--color-text-3); }

.task-stag { font-size: 11px; padding: 3px 8px; border-radius: 5px; font-weight: 500; flex-shrink: 0; }
.task-stag.todo { background: var(--color-bg-2); color: var(--color-text-2); }
.task-stag.in_progress { background: var(--color-warning-light); color: var(--color-warning-text); }

.empty-state { text-align: center; color: var(--color-text-3); font-size: 14px; padding: 48px 0; }
</style>
