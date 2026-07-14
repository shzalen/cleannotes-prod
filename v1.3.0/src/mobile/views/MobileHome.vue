<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import type { Task, TaskPriority } from '@/types'
import { toLocalDate } from '@/utils/time'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const store = useTaskStore()

const now = ref(new Date())
let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshTimer = setInterval(() => { now.value = new Date() }, 30_000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const today = computed(() => toLocalDate(now.value))

const dateLabel = computed(() => {
  const d = now.value
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[d.getDay()]}`
})

// ---- Today tasks filter (aligned with PC TodayProgress.vue) ----
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

// ---- Sort: incomplete first, then completed ----
const sortedTasks = computed(() => {
  const active: Task[] = []
  const done: Task[] = []
  for (const t of todayTasks.value) {
    if (t.status === 'done') done.push(t)
    else active.push(t)
  }
  active.sort((a, b) => {
    if (a.startDate && b.startDate) {
      const dateCmp = a.startDate.localeCompare(b.startDate)
      if (dateCmp !== 0) return dateCmp
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
    }
    if (a.startDate && !b.startDate) return -1
    if (!a.startDate && b.startDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  return [...active, ...done]
})

const activeTasks = computed(() => sortedTasks.value.filter(t => t.status !== 'done'))
const doneTasks = computed(() => sortedTasks.value.filter(t => t.status === 'done'))
const totalCount = computed(() => sortedTasks.value.length)
const doneCount = computed(() => doneTasks.value.length)

// ---- Helpers ----
function isOverdue(task: Task) {
  return !!task.startDate && task.startDate < today.value && task.status !== 'done'
}

function timeLabel(task: Task) {
  if (task.status === 'done') {
    if (task.completedAt) {
      const d = new Date(task.completedAt)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return ''
  }
  if (isOverdue(task)) return '已延期'
  return task.startTime || '--:--'
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high: { label: '高优先', color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
  medium: { label: '中优先', color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  low: { label: '低优先', color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
}

function toggleStatus(task: Task) {
  store.requestToggleStatus(task.id)
}

function openTaskDetail(task: Task) {
  router.push({ name: 'app-tasks', query: { id: task.id } })
}

function goToApps() {
  router.push({ name: 'apps' })
}
</script>

<template>
  <div class="home-page safe-top">
    <!-- Header -->
    <header class="home-header">
      <div class="header-top">
        <div>
          <p class="date-text">{{ dateLabel }}</p>
          <h1 class="page-title">今日任务</h1>
        </div>
        <div class="header-right">
          <span class="count-badge" v-if="totalCount > 0">
            {{ doneCount }} / {{ totalCount }}
          </span>
        </div>
      </div>
    </header>

    <!-- Task list -->
    <div class="task-list" v-if="sortedTasks.length">
      <!-- Active tasks -->
      <div class="section-header" v-if="activeTasks.length">
        <span>待完成 · {{ activeTasks.length }}</span>
      </div>

      <div
        v-for="task in activeTasks"
        :key="task.id"
        class="task-card"
        @click="openTaskDetail(task)"
      >
        <button
          class="status-circle"
          :class="task.status"
          @click.stop="toggleStatus(task)"
        >
          <svg v-if="task.status === 'in_progress'" viewBox="0 0 24 24" width="12" height="12">
            <circle cx="12" cy="12" r="5" fill="white" />
          </svg>
        </button>

        <div class="task-body">
          <div class="task-time" :class="{ overdue: isOverdue(task) }">
            {{ timeLabel(task) }}
          </div>
          <div class="task-title">{{ task.title }}</div>
        </div>

        <span
          v-if="task.priority !== 'low'"
          class="priority-tag"
          :style="{
            color: priorityConfig[task.priority].color,
            background: priorityConfig[task.priority].bg
          }"
        >
          {{ priorityConfig[task.priority].label }}
        </span>
      </div>

      <!-- Completed tasks -->
      <div class="section-header completed" v-if="doneTasks.length">
        <span>已完成 · {{ doneTasks.length }}</span>
      </div>

      <div
        v-for="task in doneTasks"
        :key="task.id"
        class="task-card completed"
        @click="openTaskDetail(task)"
      >
        <button
          class="status-circle done"
          @click.stop="toggleStatus(task)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path d="M5 12L10 17L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="task-body">
          <div class="task-time">{{ timeLabel(task) }}</div>
          <div class="task-title done">{{ task.title }}</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="empty-state" v-else>
      <div class="empty-icon">
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="var(--color-text-4)" stroke-width="2"/>
          <path d="M16 20H32M16 28H28" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round"/>
          <circle cx="36" cy="36" r="8" fill="var(--color-primary)"/>
          <path d="M33 36L35 38L39 34" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="empty-text">今日暂无任务</p>
      <button class="empty-btn" @click="goToApps">去应用看看</button>
    </div>

    <!-- Reactivate confirm dialog -->
    <ConfirmDialog
      :visible="store.reactivateConfirm.visible"
      title="重新激活任务"
      :message="`将已完成任务「<strong>${store.reactivateConfirm.taskTitle}</strong>」重新激活为待办？`"
      confirm-text="确认激活"
      type="warning"
      @confirm="store.confirmReactivate()"
      @cancel="store.cancelReactivate()"
    />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  padding-bottom: 80px;
}

.home-header {
  padding: 12px 20px 16px;
  background: var(--color-bg-1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.date-text {
  font-size: 13px;
  color: var(--color-text-3);
  margin: 0 0 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
}

.count-badge {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
}

.task-list {
  padding: 0 16px;
}

.section-header {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-3);
  padding: 16px 4px 8px;
}

.section-header.completed {
  padding-top: 24px;
}

.task-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.task-card:active {
  opacity: 0.7;
}

.task-card.completed {
  opacity: 0.55;
}

.status-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-text-4);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.status-circle:active {
  transform: scale(0.85);
}

.status-circle.todo {
  border-color: #C7C7CC;
}

.status-circle.in_progress {
  border-color: #FF9500;
  background: #FF9500;
}

.status-circle.done {
  border-color: #34C759;
  background: #34C759;
}

.task-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-time {
  font-size: 11px;
  color: var(--color-text-3);
  font-weight: 500;
}

.task-time.overdue {
  color: var(--color-danger);
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

.priority-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  gap: 16px;
}

.empty-icon {
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  color: var(--color-text-3);
  margin: 0;
}

.empty-btn {
  padding: 8px 24px;
  border: none;
  border-radius: 20px;
  background: var(--color-primary);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.empty-btn:active {
  opacity: 0.8;
}
</style>
