<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/task'
import { filterTasksByDate, sortTasks } from '@/utils/todayTasks'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { useTouchInteraction } from '../composables/useTouchInteraction'
import { useTabRefresh } from '../composables/useTabRefresh'

import MobileTaskDetailPopup from '../components/MobileTaskDetailPopup.vue'
import MobileTaskProgressPopup from '../components/MobileTaskProgressPopup.vue'
import MobileTaskEditPopup from '../components/MobileTaskEditPopup.vue'
import { PullRefresh as VanPullRefresh, SwipeCell as VanSwipeCell, showConfirmDialog, showToast } from 'vant'

defineOptions({ name: 'MobileCalendar' })

const taskStore = useTaskStore()

const todayStr = computed(() => toLocalDate())

// ── 周历状态 ──
const selectedDate = ref(toLocalDate())
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

interface DayCell {
  date: string
  day: number
  weekday: string
  isToday: boolean
  isSelected: boolean
  hasTasks: boolean
}

const weekDays = computed<DayCell[]>(() => {
  const today = todayStr.value
  const sel = selectedDate.value
  const ref = new Date(sel)
  const dayOfWeek = ref.getDay()
  const sunday = new Date(ref)
  sunday.setDate(ref.getDate() - dayOfWeek)

  const cells: DayCell[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    const dateStr = toLocalDate(d)
    const hasTasks = taskStore.tasks.some((t) => {
      if (t.startDate === dateStr) return true
      if (!t.startDate && t.createdAt.startsWith(dateStr)) return true
      return false
    })
    cells.push({
      date: dateStr,
      day: d.getDate(),
      weekday: weekdays[i],
      isToday: dateStr === today,
      isSelected: dateStr === sel,
      hasTasks,
    })
  }
  return cells
})

const monthLabel = computed(() => {
  const d = new Date(selectedDate.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const selectedTasks = computed(() => {
  const filtered = filterTasksByDate(taskStore.tasks, selectedDate.value)
  return sortTasks(filtered)
})

const selectedDateLabel = computed(() => {
  const d = new Date(selectedDate.value)
  const w = weekdays[d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${w}`
})

// ── 周切换 ──
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
    if (dx > 0) {
      goToPrevWeek()
    } else {
      goToNextWeek()
    }
  }
}

function goToPrevWeek() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 7)
  selectedDate.value = toLocalDate(d)
}

function goToNextWeek() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 7)
  selectedDate.value = toLocalDate(d)
}

function selectDay(date: string) {
  selectedDate.value = date
}

function goToday() {
  selectedDate.value = toLocalDate()
}

const priorityMeta: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--color-danger)' },
  medium: { label: '中', color: 'var(--color-warning)' },
  low: { label: '低', color: 'var(--color-success)' },
}

const statusMeta: Record<string, { label: string; color: string }> = {
  todo: { label: '待办', color: 'var(--color-text-3)' },
  in_progress: { label: '进行中', color: 'var(--color-warning-text)' },
  done: { label: '已完成', color: 'var(--color-primary)' },
}

// ── 截止日期格式化 mm-dd ──
function formatDueDate(due: string | null | undefined): string {
  if (!due) return ''
  const parts = due.split('-')
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
  return due
}

// ── 截止日期是否已逾期（与 PC 端 TodayProgress 一致） ──
function isOverdue(task: Task) {
  return !!task.dueDate && task.dueDate < todayStr.value
}

// ── 删除任务（带确认） ──
function handleDeleteTask(task: Task) {
  showConfirmDialog({
    title: '删除任务',
    message: `确定要删除「${task.title}」吗？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(() => {
      taskStore.deleteTask(task.id)
      showToast('已删除')
    })
    .catch(() => {})
}

// ── 详情弹窗中点击编辑：打开编辑弹窗 ──
function onDetailEdit(task: Task) {
  editPopup.value?.openEdit(task)
}

// ── 定时刷新：确保 isTimeReached / 到点脉冲随时间自动更新 ──
const now = ref(new Date())
let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { refreshTimer = setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })

function isTimeReached(task: Task) {
  if (!task.startTime || task.status === 'done') return false
  const dateToCheck = task.startDate ?? task.createdAt.slice(0, 10)
  if (dateToCheck > todayStr.value) return false
  if (dateToCheck < todayStr.value) return true
  const currentMinutes = now.value.getHours() * 60 + now.value.getMinutes()
  const [h, m] = task.startTime.split(':').map(Number)
  return currentMinutes >= (h * 60 + m)
}

// ── 下拉刷新 ──
const refreshing = ref(false)
const { refreshCounter } = useTabRefresh()

async function doRefresh() {
  refreshing.value = true
  await taskStore.load(true)
  refreshing.value = false
}

async function onRefresh() {
  await doRefresh()
}

// ── 监听 TabBar 双击刷新 ──
watch(refreshCounter, () => {
  if (!refreshing.value) {
    doRefresh()
  }
})

// ── 弹窗引用 ──
const detailPopup = ref<InstanceType<typeof MobileTaskDetailPopup> | null>(null)
const progressPopup = ref<InstanceType<typeof MobileTaskProgressPopup> | null>(null)
const editPopup = ref<InstanceType<typeof MobileTaskEditPopup> | null>(null)

const { handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchInteraction<Task>({
  onTap: (task) => detailPopup.value?.open(task),
  onLongPress: (task) => progressPopup.value?.open(task),
})

// ── 打开完整创建弹窗 ──
function openAdd() {
  editPopup.value?.openNew(selectedDate.value)
}
</script>

<template>
  <div class="cal-page">
    <!-- 固定顶栏 -->
    <header class="m-header cal-header">
      <div class="m-header__safe-area" />
      <div class="m-header__bar">
        <button class="cal-header__today-btn" @click="goToday">今天</button>
        <span class="m-header__title">{{ monthLabel }}</span>
        <button class="cal-header__add-btn" @click="openAdd">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>新增</span>
        </button>
      </div>
    </header>

    <!-- 周历 -->
    <div
      class="cal-week"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div
        v-for="cell in weekDays"
        :key="cell.date"
        class="cal-week__day"
        :class="{
          'is-today': cell.isToday,
          'is-selected': cell.isSelected,
          'has-tasks': cell.hasTasks,
        }"
        @click="selectDay(cell.date)"
      >
        <span class="cal-week__weekday">{{ cell.weekday }}</span>
        <span class="cal-week__date">{{ cell.day }}</span>
        <span v-if="cell.hasTasks" class="cal-week__dot" />
      </div>
    </div>

    <!-- 任务列表 — 下拉刷新 + 原生滚动 -->
    <van-pull-refresh
      v-model="refreshing"
      class="cal-pull-refresh"
      @refresh="onRefresh"
    >
      <div class="cal-content">
      <div class="cal-content__header">
        <span class="cal-content__date">{{ selectedDateLabel }}</span>
        <span class="cal-content__count">{{ selectedTasks.length }} 个任务</span>
      </div>

      <template v-if="selectedTasks.length > 0">
        <div class="task-list">
          <VanSwipeCell
            v-for="task in selectedTasks"
            :key="task.id"
            :disabled="task.status === 'done'"
          >
            <div
              class="task-item"
              :class="{ 'is-done': task.status === 'done' }"
              @touchstart.passive="handleTouchStart(task, $event)"
              @touchend.passive="handleTouchEnd()"
              @touchmove.passive="handleTouchMove($event)"
            >
              <span
                class="task-item__check"
                :class="[task.status, { 'is-due': isTimeReached(task) }]"
              >
                <svg v-if="task.status === 'done'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>

              <div class="task-item__body">
                <p class="task-item__title">{{ task.title }}</p>
                <div class="task-item__meta">
                  <span class="task-item__time">{{ task.startTime || '--:--' }}</span>
                  <span class="task-item__divider">·</span>
                  <span
                    class="task-item__status"
                    :style="{ color: statusMeta[task.status]?.color }"
                  >{{ statusMeta[task.status]?.label }}</span>
                  <span class="task-item__divider">·</span>
                  <span
                    v-if="task.priority"
                    class="task-item__priority"
                    :style="{ '--p-color': priorityMeta[task.priority]?.color }"
                  >{{ priorityMeta[task.priority]?.label }}</span>
                  <template v-if="task.dueDate">
                    <span class="task-item__divider">·</span>
                    <span
                      class="task-item__due"
                      :class="{ 'is-overdue': isOverdue(task) }"
                    >{{ isOverdue(task) ? '延期 ' : '截止 ' }}{{ formatDueDate(task.dueDate) }}</span>
                  </template>
                </div>
              </div>

              <span class="task-item__arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </div>

            <template #right>
              <div class="task-swipe-actions">
                <button class="task-swipe-btn task-swipe-btn--delete" @click="handleDeleteTask(task)">删除</button>
              </div>
            </template>
          </VanSwipeCell>
        </div>
      </template>

      <div v-else class="cal-empty">
        <p class="cal-empty__text">当日无任务</p>
      </div>
    </div>
    </van-pull-refresh>

    <!-- 任务详情弹窗 -->
    <MobileTaskDetailPopup ref="detailPopup" @edit="onDetailEdit" />

    <!-- 进度更新弹窗 -->
    <MobileTaskProgressPopup ref="progressPopup" />

    <!-- 完整任务创建弹窗 -->
    <MobileTaskEditPopup ref="editPopup" />
  </div>
</template>

<style scoped>
.cal-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /* overflow: hidden 会裁剪内部滚动容器的橡皮筋回弹效果；
     m-layout__body 已做 overflow:hidden 防止穿透 */
  background: var(--color-bg-1);
}

/* ── 顶栏 ── */
.cal-header .m-header__bar {
  justify-content: space-between;
}

.cal-header__today-btn {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
}

.cal-header__add-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
}

.cal-header__add-btn svg {
  width: 16px;
  height: 16px;
}

/* ── 周历 ── */
.cal-week {
  flex-shrink: 0;
  display: flex;
  padding: 8px 4px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  touch-action: pan-y;
}

.cal-week__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  cursor: pointer;
  position: relative;
  transition: background 0.12s ease;
  border-radius: 8px;
}

.cal-week__day:active {
  background: var(--color-bg-3);
}

.cal-week__weekday {
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 4px;
}

.cal-week__date {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.cal-week__day.is-today .cal-week__date {
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
}

.cal-week__day.is-selected .cal-week__date {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.cal-week__day.is-today.is-selected .cal-week__date {
  background: var(--color-primary);
  color: #fff;
}

.cal-week__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 3px;
  opacity: 0.6;
}

/* ── 下拉刷新容器 ── */
.cal-pull-refresh {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: auto; /* 恢复 iOS 橡皮筋效果 */
  -webkit-overflow-scrolling: touch;
}

/* ── 内容区（原生滚动 + 阻尼效果） ── */
.cal-content {
  min-height: 100%;
  padding: 12px 12px 16px;
  touch-action: pan-y pan-x; /* 允许垂直滚动 + 水平滑动（SwipeCell） */
}

.cal-content__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}

.cal-content__date {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.cal-content__count {
  font-size: 12px;
  color: var(--color-text-3);
}

.cal-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  color: var(--color-text-3);
}

.cal-empty__text {
  margin: 0;
  font-size: 14px;
}

/* ── 任务项 ── */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* SwipeCell 容器样式覆盖 */
.task-list :deep(.van-swipe-cell) {
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
}
/* 注意：.van-swipe-cell 不能设 overflow:hidden，否则右滑按钮会被裁剪 */

.task-list :deep(.van-swipe-cell__wrapper) {
  border-radius: 12px;
  overflow: hidden;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-surface);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  touch-action: manipulation;
}

.task-item:active {
  transform: scale(0.98);
}

.task-item.is-done {
  opacity: 0.55;
}

.task-item__check {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  transition: border-color 0.2s ease, background 0.2s ease;
  position: relative;
}

/* 待办 → 灰色 */
.task-item__check.todo {
  border-color: var(--color-border);
  background: var(--color-text-4);
}

/* 进行中 → 橙色 */
.task-item__check.in_progress {
  border-color: var(--color-warning-text);
  background: var(--color-warning);
}

/* 已完成 → 绿色 */
.task-item__check.done {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

/* 到点脉冲线圈 */
.task-item__check.is-due::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid var(--color-warning);
  animation: h5-dot-pulse 1.2s ease-out infinite;
  pointer-events: none;
}

@keyframes h5-dot-pulse {
  0%   { transform: scale(0.6); opacity: 0.9; }
  100% { transform: scale(1.8); opacity: 0; }
}

.task-item__check svg {
  width: 14px;
  height: 14px;
}

.task-item__body {
  flex: 1;
  min-width: 0;
}

.task-item__title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item.is-done .task-item__title {
  text-decoration: line-through;
  color: var(--color-text-3);
}

.task-item__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.task-item__divider {
  font-size: 11px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.task-item__status {
  font-size: 12px;
  font-weight: 500;
}

.task-item__priority {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-color, var(--color-text-3));
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--p-color, var(--color-text-3)) 12%, transparent);
}

.task-item__time {
  font-size: 12px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}

.task-item__due {
  font-size: 11px;
  color: var(--color-text-4);
  font-variant-numeric: tabular-nums;
}

.task-item__due.is-overdue {
  color: var(--color-danger);
  font-weight: 600;
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── SwipeCell 滑动操作按钮 ── */
.task-swipe-actions {
  display: flex;
  height: 100%;
}

.task-swipe-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 100%;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.task-swipe-btn--delete {
  background: var(--color-danger);
}

.task-item__arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 2px;
  color: var(--color-text-4);
  opacity: 0.4;
}
.task-item__arrow svg {
  width: 14px;
  height: 14px;
}
</style>
