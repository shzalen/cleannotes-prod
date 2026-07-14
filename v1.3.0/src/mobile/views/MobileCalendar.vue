<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { Swipe as VanSwipe, SwipeItem as VanSwipeItem, PullRefresh as VanPullRefresh, CellGroup as VanCellGroup, Cell as VanCell, Tag as VanTag, Empty as VanEmpty, Button as VanButton } from 'vant'
import TaskDetailSheet from '@/mobile/components/TaskDetailSheet.vue'
import TaskCreateSheet from '@/mobile/components/TaskCreateSheet.vue'

const store = useTaskStore()

const now = new Date()
const todayStr = toLocalDate(now)
const selectedDate = ref(todayStr)

function getMonday(date: Date): Date {
  const d = new Date(date); d.setHours(0,0,0,0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

const weekBase = ref(getMonday(new Date()))

const weekDays = computed(() => {
  const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean; hasTasks: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekBase.value); d.setDate(d.getDate() + i)
    const ds = toLocalDate(d)
    days.push({
      dateStr: ds,
      dayName: ['一','二','三','四','五','六','日'][i],
      dayNum: d.getDate(),
      isToday: ds === todayStr,
      hasTasks: store.tasks.some(t => (t.startDate || t.createdAt.slice(0,10)) === ds),
    })
  }
  return days
})

const weekLabel = computed(() => {
  const s = weekBase.value
  const e = new Date(s); e.setDate(e.getDate() + 6)
  return `${s.getFullYear()}年${s.getMonth()+1}月${s.getDate()}日 - ${e.getMonth()+1}月${e.getDate()}日`
})

function onSwipeChange(index: number) {
  const d = new Date(weekBase.value)
  d.setDate(d.getDate() + (index - 1) * 7)
  weekBase.value = d
}

function prevWeek() { weekBase.value = new Date(weekBase.value.setDate(weekBase.value.getDate() - 7)) }
function nextWeek() { weekBase.value = new Date(weekBase.value.setDate(weekBase.value.getDate() + 7)) }

// ── 任务 ──
const dayTasks = computed(() =>
  store.tasks.filter(t => {
    const sd = t.startDate || t.createdAt.slice(0,10)
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
const refreshing = ref(false)
async function onRefresh() {
  try { await store.load(true) } finally { refreshing.value = false }
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
        <VanButton type="primary" size="small" plain @click="openCreate">新增</VanButton>
      </div>
    </div>

    <!-- 日历条 van-swipe -->
    <VanSwipe :show-indicators="false" :loop="false" initial-swipe="1" @change="onSwipeChange" class="week-swipe">
      <VanSwipeItem v-for="offset in [-1, 0, 1]" :key="offset">
        <div class="week-days">
          <button
            v-for="d in (offset === -1 ? weekDays : offset === 0 ? weekDays : weekDays)"
            :key="d.dateStr + offset"
            class="day-cell"
            :class="{ today: d.isToday, selected: selectedDate === d.dateStr }"
            @click="selectDate(d.dateStr)"
          >
            <span class="day-name">{{ d.dayName }}</span>
            <span class="day-num">{{ d.dayNum }}</span>
            <span v-if="d.hasTasks" class="day-dot" />
          </button>
        </div>
      </VanSwipeItem>
    </VanSwipe>

    <div class="week-label-text">{{ weekLabel }}</div>

    <!-- 任务列表 -->
    <VanPullRefresh v-model="refreshing" @refresh="onRefresh" class="cal-scroll">
      <VanCellGroup v-if="dayTasks.length" inset class="task-group">
        <VanCell
          v-for="task in dayTasks"
          :key="task.id"
          class="task-cell"
          :class="{ 'is-done': task.status === 'done' }"
          clickable
          @click="showDetail(task)"
        >
          <template #title>
            <span class="task-time">{{ timeLabel(task) }}</span>
          </template>
          <template #value>
            <span class="task-title" :class="task.status">{{ task.title }}</span>
          </template>
          <template #right-icon>
            <VanTag v-if="task.status !== 'done'" :type="task.status === 'in_progress' ? 'warning' : 'default'" size="mini">
              {{ statusLabel[task.status] }}
            </VanTag>
          </template>
        </VanCell>
      </VanCellGroup>
      <VanEmpty v-else description="当天暂无任务" />
    </VanPullRefresh>

    <TaskDetailSheet ref="detailSheet" />
    <TaskCreateSheet ref="createSheet" />
  </div>
</template>

<style scoped>
.cal-page {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; background: var(--color-bg-0, #fff);
}

.cal-header {
  background: var(--color-surface, #fff);
  border-bottom: 0.5px solid var(--color-border, rgba(0,0,0,0.08));
  flex-shrink: 0;
}

.cal-header-row {
  display: flex; align-items: center; padding: 12px 16px 8px;
}

.cal-header-spacer { width: 60px; }

.cal-title {
  flex: 1; text-align: center; font-size: 18px; font-weight: 600;
  color: var(--color-text-1, #0F172A);
}

/* ── Week Swipe ── */
.week-swipe {
  background: var(--color-surface, #fff);
  flex-shrink: 0;
}

.week-days {
  display: flex; justify-content: space-around; padding: 8px 0;
}

.day-cell {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  border: none; background: none; cursor: pointer; position: relative;
  border-radius: 12px; width: 42px; padding: 4px 0;
  -webkit-tap-highlight-color: transparent;
}

.day-cell:active { opacity: 0.6; }

.day-name { font-size: 11px; color: var(--color-text-3); }

.day-num {
  font-size: 16px; font-weight: 500; color: var(--color-text-1);
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;
}

.day-cell.today .day-num { background: var(--color-primary); color: #fff; font-weight: 700; }
.day-cell.selected:not(.today) .day-num { border: 2px solid var(--color-primary); color: var(--color-primary); }
.day-cell.today .day-name { color: var(--color-primary); font-weight: 600; }

.day-dot {
  width: 4px; height: 4px; border-radius: 50%; background: var(--color-primary); position: absolute; bottom: 0;
}

.week-label-text {
  text-align: center; font-size: 12px; color: var(--color-text-3);
  padding: 6px 0; background: var(--color-surface, #fff); flex-shrink: 0;
}

.cal-scroll { flex: 1; overflow-y: auto; }

.task-group { margin: 8px 16px; }

.task-cell { align-items: center; }
.task-cell.is-done { opacity: 0.6; }

.task-time {
  font-size: 13px; font-weight: 600; color: var(--color-text-2);
  font-variant-numeric: tabular-nums; min-width: 36px; display: inline-block;
}

.task-title {
  font-size: 15px; font-weight: 500; color: var(--color-text-1);
}

.task-title.done { text-decoration: line-through; color: var(--color-text-3); }
</style>
