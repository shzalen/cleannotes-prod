<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useTaskStore } from '@/stores/task'
import { filterTasksByDate, sortTasks } from '@/utils/todayTasks'
import { toLocalDate } from '@/utils/time'
import type { Task, TaskPriority } from '@/types'
import { showToast } from 'vant'

defineOptions({ name: 'MobileCalendar' })

const taskStore = useTaskStore()

const todayStr = computed(() => toLocalDate())

// ── 周历状态 ──
// selectedDate 始终指向当前选中的日期（默认今天）
const selectedDate = ref(toLocalDate())
// weekOffset: 0=本周, 1=下周, -1=上周
const weekOffset = ref(0)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

interface DayCell {
  date: string // YYYY-MM-DD
  day: number
  weekday: string
  isToday: boolean
  isSelected: boolean
  hasTasks: boolean
}

const weekDays = computed<DayCell[]>(() => {
  const today = todayStr.value
  const sel = selectedDate.value
  // 以选中日期所在周的周日为起点（周日~周六）
  const ref = new Date(sel)
  const dayOfWeek = ref.getDay() // 0=Sunday
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

// 当前显示的月份范围标题
const monthLabel = computed(() => {
  const d = new Date(selectedDate.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

// 选中日期的任务列表
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
  // 只响应水平滑动（水平位移 > 垂直位移且 > 50px）
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

// ── 任务切换状态 ──
function toggleTask(task: Task) {
  taskStore.requestToggleStatus(task.id)
}

const priorityMeta: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--color-danger)' },
  medium: { label: '中', color: 'var(--color-warning)' },
  low: { label: '低', color: 'var(--color-success)' },
}

// ── 新增任务弹窗 ──
const showAdd = ref(false)
const addForm = reactive({
  title: '',
  priority: 'medium' as TaskPriority,
  startDate: '',
  startTime: '',
})

function openAdd() {
  addForm.title = ''
  addForm.priority = 'medium'
  addForm.startDate = selectedDate.value
  addForm.startTime = ''
  showAdd.value = true
}

function confirmAdd() {
  const title = addForm.title.trim()
  if (!title) {
    showToast('请输入任务标题')
    return
  }
  taskStore.addTask({
    title,
    priority: addForm.priority,
    startDate: addForm.startDate || null,
    startTime: addForm.startTime || null,
  })
  showAdd.value = false
  showToast('已添加')
}

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]
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

    <!-- 任务列表 -->
    <div class="cal-content">
      <div class="cal-content__header">
        <span class="cal-content__date">{{ selectedDateLabel }}</span>
        <span class="cal-content__count">{{ selectedTasks.length }} 个任务</span>
      </div>

      <template v-if="selectedTasks.length > 0">
        <div class="task-list">
          <div
            v-for="task in selectedTasks"
            :key="task.id"
            class="task-item"
            :class="{ 'is-done': task.status === 'done' }"
            @click="toggleTask(task)"
          >
            <span class="task-item__check">
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
                <span
                  v-if="task.priority"
                  class="task-item__priority"
                  :style="{ '--p-color': priorityMeta[task.priority]?.color }"
                >{{ priorityMeta[task.priority]?.label }}</span>
                <span v-if="task.startTime" class="task-item__time">{{ task.startTime }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="cal-empty">
        <p class="cal-empty__text">当日无任务</p>
      </div>
    </div>

    <!-- 新增任务弹窗 -->
    <van-popup
      v-model:show="showAdd"
      position="bottom"
      round
      teleport="body"
    >
      <div class="add-sheet">
        <div class="add-sheet__header">
          <span class="add-sheet__title">新增任务</span>
          <button class="add-sheet__close" @click="showAdd = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="add-sheet__body">
          <van-cell-group inset>
            <van-field
              v-model="addForm.title"
              label="标题"
              placeholder="输入任务标题"
              clearable
            />
            <van-field name="priority" label="优先级">
              <template #input>
                <van-radio-group v-model="addForm.priority" direction="horizontal">
                  <van-radio
                    v-for="opt in priorityOptions"
                    :key="opt.value"
                    :name="opt.value"
                  >{{ opt.label }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field
              v-model="addForm.startDate"
              label="日期"
              placeholder="选择日期"
              readonly
              clickable
              is-link
              @click=""
            >
              <template #right-icon>
                <input
                  v-model="addForm.startDate"
                  type="date"
                  class="add-sheet__date-input"
                />
              </template>
            </van-field>
            <van-field
              v-model="addForm.startTime"
              label="时间"
              placeholder="选择时间"
              readonly
              is-link
            >
              <template #right-icon>
                <input
                  v-model="addForm.startTime"
                  type="time"
                  class="add-sheet__date-input"
                />
              </template>
            </van-field>
          </van-cell-group>
        </div>
        <div class="add-sheet__footer">
          <van-button block round type="primary" @click="confirmAdd">添加</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.cal-page {
  display: flex;
  flex-direction: column;
  height: 100%;
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

/* ── 内容区 ── */
.cal-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 80px;
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

/* ── 任务项（复用首页样式） ── */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
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
  transition: border-color 0.2s ease;
}

.task-item.is-done .task-item__check {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
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
  gap: 8px;
  margin-top: 4px;
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
}

/* ── 新增弹窗 ── */
.add-sheet {
  background: var(--color-surface);
  padding-bottom: var(--safe-bottom);
}

.add-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.add-sheet__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.add-sheet__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
}

.add-sheet__close svg {
  width: 20px;
  height: 20px;
}

.add-sheet__body {
  padding: 12px 0 0;
}

.add-sheet__footer {
  padding: 12px 16px 16px;
}

.add-sheet__date-input {
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--color-text-1);
  outline: none;
  width: auto;
}
</style>
