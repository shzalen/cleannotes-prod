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

const weekLabel = computed(() => {
  const s = weekBase.value
  const e = new Date(s); e.setDate(e.getDate() + 6)
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`
})

// ── 日历无限衔接滑动（iOS 原生风格） ──
const swipeStartX = ref(0)
const swipeDeltaX = ref(0)
const isSwiping = ref(false)
const swipeSnap = ref<'prev' | 'current' | 'next'>('current')
const weekSliderEl = ref<HTMLElement | null>(null)

// 三周数据：prev / current / next
const prevWeekBase = computed(() => {
  const d = new Date(weekBase.value); d.setDate(d.getDate() - 7); return d
})
const nextWeekBase = computed(() => {
  const d = new Date(weekBase.value); d.setDate(d.getDate() + 7); return d
})

function buildWeekDays(base: Date) {
  const days: { date: Date; dateStr: string; dayName: string; dayNum: number; isToday: boolean; hasTasks: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i)
    const ds = toLocalDate(d)
    days.push({
      date: d, dateStr: ds,
      dayName: ['一', '二', '三', '四', '五', '六', '日'][i],
      dayNum: d.getDate(), isToday: ds === todayStr,
      hasTasks: store.tasks.some(t => {
        const sd = t.startDate || t.createdAt.slice(0, 10)
        return sd === ds
      }),
    })
  }
  return days
}

const prevWeekDays = computed(() => buildWeekDays(prevWeekBase.value))
const currentWeekDays = computed(() => buildWeekDays(weekBase.value))
const nextWeekDays = computed(() => buildWeekDays(nextWeekBase.value))

function onTouchStart(e: TouchEvent) {
  swipeStartX.value = e.touches[0].clientX
  swipeDeltaX.value = 0
  isSwiping.value = false  // 初始不是滑动，等移动后再判定
}

function onTouchMove(e: TouchEvent) {
  const dx = e.touches[0].clientX - swipeStartX.value
  if (Math.abs(dx) > 5) {
    // 移动超过 5px 才算滑动
    if (!isSwiping.value) isSwiping.value = true
    swipeDeltaX.value = dx
  }
}

function onTouchEnd() {
  if (!isSwiping.value) return
  isSwiping.value = false

  const el = weekSliderEl.value
  const containerWidth = el?.clientWidth || 320
  const threshold = containerWidth * 0.3  // 30% 阈值切换

  if (swipeDeltaX.value > threshold) {
    // 向右滑 → 上一周
    swipeSnap.value = 'prev'
    setTimeout(() => {
      weekBase.value = new Date(prevWeekBase.value)
      swipeDeltaX.value = 0
      swipeSnap.value = 'current'
    }, 300)
  } else if (swipeDeltaX.value < -threshold) {
    // 向左滑 → 下一周
    swipeSnap.value = 'next'
    setTimeout(() => {
      weekBase.value = new Date(nextWeekBase.value)
      swipeDeltaX.value = 0
      swipeSnap.value = 'current'
    }, 300)
  } else {
    // 回弹到当前周
    swipeDeltaX.value = 0
  }
}

function prevWeek() {
  swipeDeltaX.value = 0
  swipeSnap.value = 'prev'
  setTimeout(() => {
    weekBase.value = new Date(prevWeekBase.value)
    swipeSnap.value = 'current'
  }, 300)
}

function nextWeek() {
  swipeDeltaX.value = 0
  swipeSnap.value = 'next'
  setTimeout(() => {
    weekBase.value = new Date(nextWeekBase.value)
    swipeSnap.value = 'current'
  }, 300)
}

// slider translateX 计算
const sliderTransform = computed(() => {
  if (swipeSnap.value === 'prev') return 'translateX(33.33%)'
  if (swipeSnap.value === 'next') return 'translateX(-33.33%)'
  if (isSwiping.value) {
    const el = weekSliderEl.value
    const w = el?.clientWidth || 320
    return `translateX(${swipeDeltaX.value - (w / 3)}px)`
  }
  // 默认停在中间（当前周）
  return 'translateX(-33.33%)'
})

const sliderTransition = computed(() => {
  if (isSwiping.value) return 'none'
  if (swipeSnap.value !== 'current') return 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)'
  return 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)'
})

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

// ── 橡皮筋效果（下拉刷新 + 底部弹性） ──
const scrollEl = ref<HTMLElement | null>(null)
const bounceOffset = ref(0)
const bounceActive = ref(false)
const refreshing = ref(false)
const touchStartY = ref(0)
const isAtTop = ref(false)
const isAtBottom = ref(false)

function onScrollTouchStart(e: TouchEvent) {
  const el = scrollEl.value
  if (!el || refreshing.value) return
  touchStartY.value = e.touches[0].clientY
  isAtTop.value = el.scrollTop <= 0
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
}

function onScrollTouchMove(e: TouchEvent) {
  const el = scrollEl.value
  if (!el || refreshing.value) return
  const dy = e.touches[0].clientY - touchStartY.value

  if (isAtTop.value && dy > 0 && el.scrollTop <= 0) {
    bounceActive.value = true
    bounceOffset.value = Math.min(dy, 160) * 0.35
    if (e.cancelable) e.preventDefault()
    return
  }

  if (isAtBottom.value && dy < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
    bounceActive.value = true
    bounceOffset.value = Math.max(dy, -160) * 0.35
    if (e.cancelable) e.preventDefault()
    return
  }

  bounceActive.value = false
  bounceOffset.value = 0
}

async function onScrollTouchEnd() {
  if (refreshing.value) return

  if (bounceActive.value && bounceOffset.value >= 40 && isAtTop.value) {
    refreshing.value = true
    bounceOffset.value = 40
    try {
      await store.load(true)
    } finally {
      refreshing.value = false
      bounceOffset.value = 0
      bounceActive.value = false
    }
    return
  }

  bounceActive.value = false
  bounceOffset.value = 0
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

    <!-- Week Strip with iOS-style swipe -->
    <div
      class="week-strip"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <button class="week-arrow" @click="prevWeek">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18L9 12L15 6"/></svg>
      </button>

      <div ref="weekSliderEl" class="week-slider">
        <div
          class="week-slider-track"
          :style="{ transform: sliderTransform, transition: sliderTransition }"
        >
          <!-- Prev week -->
          <div class="week-page">
            <button
              v-for="d in prevWeekDays"
              :key="'p'+d.dateStr"
              class="day-cell"
              :class="{ today: d.isToday, selected: selectedDate === d.dateStr }"
              @click="selectDate(d.dateStr)"
            >
              <span class="day-name">{{ d.dayName }}</span>
              <span class="day-num">{{ d.dayNum }}</span>
              <span v-if="d.hasTasks" class="day-dot" />
            </button>
          </div>
          <!-- Current week -->
          <div class="week-page">
            <button
              v-for="d in currentWeekDays"
              :key="'c'+d.dateStr"
              class="day-cell"
              :class="{ today: d.isToday, selected: selectedDate === d.dateStr }"
              @click="selectDate(d.dateStr)"
            >
              <span class="day-name">{{ d.dayName }}</span>
              <span class="day-num">{{ d.dayNum }}</span>
              <span v-if="d.hasTasks" class="day-dot" />
            </button>
          </div>
          <!-- Next week -->
          <div class="week-page">
            <button
              v-for="d in nextWeekDays"
              :key="'n'+d.dateStr"
              class="day-cell"
              :class="{ today: d.isToday, selected: selectedDate === d.dateStr }"
              @click="selectDate(d.dateStr)"
            >
              <span class="day-name">{{ d.dayName }}</span>
              <span class="day-num">{{ d.dayNum }}</span>
              <span v-if="d.hasTasks" class="day-dot" />
            </button>
          </div>
        </div>
      </div>

      <button class="week-arrow" @click="nextWeek">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18L15 12L9 6"/></svg>
      </button>
    </div>

    <div class="week-label-text">{{ weekLabel }}</div>

    <!-- Task List with rubber-band pull-refresh -->
    <div
      ref="scrollEl"
      class="cal-scroll"
      @touchstart="onScrollTouchStart"
      @touchmove="onScrollTouchMove"
      @touchend="onScrollTouchEnd"
    >
      <div
        class="scroll-wrapper"
        :style="{
          transform: `translateY(${bounceOffset}px)`,
          transition: bounceActive || refreshing ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)'
        }"
      >
        <div class="pull-indicator" :style="{ height: bounceOffset > 0 && isAtTop ? bounceOffset + 'px' : '0px', opacity: Math.min(bounceOffset / 40, 1) }">
          <span v-if="!refreshing && bounceOffset > 0" class="pull-text">{{ bounceOffset >= 40 ? '松开刷新' : '下拉刷新' }}</span>
          <span v-else-if="refreshing" class="pull-spinner" />
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
      </div> <!-- .scroll-wrapper -->
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
  flex: 1; text-align: center; font-size: 18px; font-weight: 600; color: var(--color-text-1);
}

.cal-add-btn {
  width: 52px; text-align: right; background: none; border: none;
  font-size: 16px; font-weight: 500; color: var(--color-primary); cursor: pointer; flex-shrink: 0;
}

.cal-add-btn:active { opacity: 0.6; }

/* ── Week Strip ── */
.week-strip {
  display: flex; align-items: center;
  background: var(--color-surface); flex-shrink: 0;
  overflow: hidden; touch-action: pan-y;
}

.week-arrow {
  width: 36px; height: 50px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--color-text-3); cursor: pointer; flex-shrink: 0;
  z-index: 1;
}

.week-arrow:active { opacity: 0.5; }

.week-slider {
  flex: 1; overflow: hidden; padding: 8px 0;
}

.week-slider-track {
  display: flex;
  width: 300%;
}

.week-page {
  flex: 1;
  display: flex;
  justify-content: space-around;
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
}

.scroll-wrapper {
  min-height: 100%;
  padding: 8px 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.pull-indicator {
  display: flex; align-items: center; justify-content: center; overflow: hidden;
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
  font-size: 13px; font-weight: 600; color: var(--color-text-2);
  width: 40px; flex-shrink: 0; font-variant-numeric: tabular-nums;
}

.task-time.done { font-size: 11px; font-weight: 400; color: var(--color-text-4); }

.task-title {
  flex: 1; font-size: 15px; font-weight: 500; color: var(--color-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.task-title.done { text-decoration: line-through; color: var(--color-text-3); }

.task-stag { font-size: 11px; padding: 3px 8px; border-radius: 5px; font-weight: 500; flex-shrink: 0; }
.task-stag.todo { background: var(--color-bg-2); color: var(--color-text-2); }
.task-stag.in_progress { background: var(--color-warning-light); color: var(--color-warning-text); }

.empty-state { text-align: center; color: var(--color-text-3); font-size: 14px; padding: 48px 0; }
</style>
