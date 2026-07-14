<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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

const isLoaded = ref(false)
watch(() => store.loaded, (val) => { if (val) isLoaded.value = true }, { immediate: true })

const today = computed(() => toLocalDate(now.value))

const dateLabel = computed(() => {
  const d = now.value
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[d.getDay()]}`
})

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

// ── Progress ring ──
const progress = computed(() => totalCount.value === 0 ? 0 : Math.round((doneCount.value / totalCount.value) * 100))
const circumference = 2 * Math.PI * 36
const progressOffset = computed(() => circumference * (1 - progress.value / 100))

// ── Task detail sheet ──
const showDetailSheet = ref(false)
const detailTask = ref<Task | null>(null)

function openTaskDetail(task: Task) {
  detailTask.value = task
  showDetailSheet.value = true
}

function closeDetailSheet() {
  showDetailSheet.value = false
  detailTask.value = null
}

function fmtTime(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}`
}

function isFutureTask(task: Task) {
  const todayStr = today.value
  return task.startDate ? task.startDate > todayStr : task.createdAt.slice(0, 10) > todayStr
}

function goToApps() {
  router.push({ name: 'apps' })
}
</script>

<template>
  <div class="home-page safe-top">
    <!-- Loading skeleton -->
    <template v-if="!isLoaded">
      <div class="loading-area">
        <div class="skeleton skeleton-date" />
        <div class="skeleton skeleton-title" />
        <div class="skeleton skeleton-ring" />
        <div v-for="i in 3" :key="i" class="skeleton skeleton-card" />
      </div>
    </template>

    <!-- Loaded content -->
    <template v-else>
      <!-- Header with progress ring -->
      <header class="home-header">
        <div class="header-main">
          <div class="header-text">
            <p class="date-text">{{ dateLabel }}</p>
            <h1 class="page-title">今日任务</h1>
          </div>
          <!-- Progress ring -->
          <div class="progress-ring-wrapper" v-if="totalCount > 0">
            <svg class="progress-ring" viewBox="0 0 80 80">
              <circle class="ring-bg" cx="40" cy="40" r="36" />
              <circle
                class="ring-fill"
                cx="40" cy="40" r="36"
                :style="{ strokeDasharray: circumference, strokeDashoffset: progressOffset }"
              />
            </svg>
            <span class="ring-text">{{ progress }}%</span>
          </div>
        </div>
      </header>

      <!-- Task list -->
      <div class="task-list" v-if="sortedTasks.length">
        <!-- Active tasks -->
        <div class="section-header" v-if="activeTasks.length">
          <span class="section-dot active" />
          <span>待完成</span>
          <span class="section-count">{{ activeTasks.length }}</span>
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
            <div class="task-title">{{ task.title }}</div>
            <div class="task-meta">
              <span class="task-time" :class="{ overdue: isOverdue(task) }">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" class="time-icon">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M12 7V12L15 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                {{ timeLabel(task) }}
              </span>
              <span
                v-if="task.priority !== 'low'"
                class="priority-dot"
                :style="{ background: priorityConfig[task.priority].color }"
              />
            </div>
          </div>
          <svg class="card-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Completed tasks -->
        <div class="section-header completed" v-if="doneTasks.length">
          <span class="section-dot done" />
          <span>已完成</span>
          <span class="section-count">{{ doneTasks.length }}</span>
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
            <div class="task-title done">{{ task.title }}</div>
            <div class="task-meta">
              <span class="task-time">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" class="time-icon">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ timeLabel(task) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" v-else>
        <div class="empty-illustration">
          <svg viewBox="0 0 120 100" fill="none" width="120" height="100">
            <rect x="20" y="10" width="80" height="70" rx="10" fill="var(--color-bg-2)" stroke="var(--color-border)" stroke-width="1.5"/>
            <rect x="32" y="24" width="56" height="6" rx="3" fill="var(--color-border)"/>
            <rect x="32" y="38" width="40" height="6" rx="3" fill="var(--color-border-light)"/>
            <rect x="32" y="52" width="48" height="6" rx="3" fill="var(--color-border-light)"/>
            <circle cx="88" cy="88" r="24" fill="var(--color-primary)" opacity="0.12"/>
            <path d="M81 88L86 93L95 84" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="empty-text">今日暂无任务</p>
        <p class="empty-hint">在应用中添加任务，开始规划你的一天</p>
        <button class="empty-btn" @click="goToApps">去应用看看</button>
      </div>
    </template>

    <ConfirmDialog
      :visible="store.reactivateConfirm.visible"
      title="重新激活任务"
      :message="`将已完成任务「<strong>${store.reactivateConfirm.taskTitle}</strong>」重新激活为待办？`"
      confirm-text="确认激活"
      type="warning"
      @confirm="store.confirmReactivate()"
      @cancel="store.cancelReactivate()"
    />

    <!-- Task Detail Bottom Sheet -->
    <div v-if="showDetailSheet && detailTask" class="sheet-overlay" @click="closeDetailSheet">
      <div class="detail-sheet safe-bottom" @click.stop>
        <div class="sheet-handle" />

        <div class="detail-header">
          <div class="detail-status-row">
            <span
              class="detail-status-badge"
              :class="detailTask.status"
            >
              {{ detailTask.status === 'todo' ? '待办' : detailTask.status === 'in_progress' ? '进行中' : '已完成' }}
            </span>
            <span
              v-if="detailTask.priority !== 'low'"
              class="detail-priority-badge"
              :style="{ color: priorityConfig[detailTask.priority].color, background: priorityConfig[detailTask.priority].bg }"
            >
              {{ priorityConfig[detailTask.priority].label }}
            </span>
          </div>
          <h2 class="detail-title">{{ detailTask.title }}</h2>
        </div>

        <div class="detail-meta-list">
          <div v-if="detailTask.startDate" class="detail-meta-item">
            <span class="meta-icon">📅</span>
            <span class="meta-label">计划��始</span>
            <span class="meta-value">{{ detailTask.startDate }} {{ detailTask.startTime || '' }}</span>
          </div>
          <div v-if="detailTask.dueDate" class="detail-meta-item">
            <span class="meta-icon">⏰</span>
            <span class="meta-label">截止日期</span>
            <span class="meta-value">{{ detailTask.dueDate }}</span>
          </div>
          <div v-if="detailTask.inProgressAt" class="detail-meta-item">
            <span class="meta-icon">▶️</span>
            <span class="meta-label">开始执行</span>
            <span class="meta-value">{{ fmtTime(detailTask.inProgressAt) }}</span>
          </div>
          <div v-if="detailTask.completedAt" class="detail-meta-item">
            <span class="meta-icon">✅</span>
            <span class="meta-label">完成时间</span>
            <span class="meta-value">{{ fmtTime(detailTask.completedAt) }}</span>
          </div>
        </div>

        <div v-if="detailTask.description" class="detail-desc">
          <p class="desc-label">描述</p>
          <p class="desc-text">{{ detailTask.description }}</p>
        </div>

        <div class="detail-actions">
          <button
            v-if="detailTask.status !== 'done' && !isFutureTask(detailTask)"
            class="detail-btn primary"
            @click="toggleStatus(detailTask); closeDetailSheet()"
          >
            {{ detailTask.status === 'todo' ? '开始执行' : '标记完成' }}
          </button>
          <button
            v-if="detailTask.status === 'done'"
            class="detail-btn primary"
            @click="toggleStatus(detailTask); closeDetailSheet()"
          >
            重新激活
          </button>
          <button class="detail-btn secondary" @click="closeDetailSheet">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-0);
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 20px);
}

/* ===== Loading ===== */
.loading-area {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton {
  background: var(--color-bg-2);
  border-radius: 10px;
  animation: shimmer 1.5s ease-in-out infinite;
}
.skeleton-date { width: 100px; height: 16px; }
.skeleton-title { width: 140px; height: 32px; border-radius: 12px; }
.skeleton-ring { width: 80px; height: 80px; border-radius: 50%; align-self: flex-end; margin-top: -40px; }
.skeleton-card { height: 64px; border-radius: 14px; }
@keyframes shimmer {
  0% { opacity: 0.35; }
  50% { opacity: 0.6; }
  100% { opacity: 0.35; }
}

/* ===== Header ===== */
.home-header {
  padding: 20px 20px 8px;
  background: var(--color-bg-0);
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.date-text {
  font-size: 15px;
  color: var(--color-text-3);
  margin: 0 0 6px;
  font-weight: 500;
}

.page-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

/* ===== Progress ring ===== */
.progress-ring-wrapper {
  position: relative;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
}

.progress-ring {
  width: 68px;
  height: 68px;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--color-bg-2);
  stroke-width: 5;
}

.ring-fill {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}

/* ===== Task list ===== */
.task-list {
  padding: 0 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-2);
  padding: 20px 6px 12px;
}

.section-header.completed {
  padding-top: 28px;
}

.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.section-dot.active {
  background: var(--color-primary);
}

.section-dot.done {
  background: var(--color-success);
}

.section-count {
  font-size: 12px;
  color: var(--color-text-4);
  font-weight: 500;
  background: var(--color-bg-2);
  padding: 2px 8px;
  border-radius: 10px;
}

/* ===== Task card ===== */
.task-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--color-surface);
  border-radius: 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  border: 1px solid var(--color-border-light);
}

.task-card:active {
  background: var(--color-bg-2);
}

.task-card.completed {
  opacity: 0.55;
  background: var(--color-bg-1);
}

.status-circle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid var(--color-text-4);
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

.status-circle.todo { border-color: #C7C7CC; }
.status-circle.in_progress { border-color: #FF9500; background: #FF9500; }
.status-circle.done { border-color: #34C759; background: #34C759; }

.task-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.task-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--color-text-3);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-3);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.task-time.overdue {
  color: var(--color-danger);
}

.time-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.priority-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-arrow {
  flex-shrink: 0;
  opacity: 0.4;
}

/* ===== Empty state ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  gap: 12px;
}

.empty-illustration {
  margin-bottom: 8px;
  opacity: 0.6;
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-2);
  margin: 0;
}

.empty-hint {
  font-size: 14px;
  color: var(--color-text-4);
  margin: 0 0 12px;
  text-align: center;
  line-height: 1.5;
}

.empty-btn {
  padding: 12px 36px;
  border: none;
  border-radius: 24px;
  background: var(--color-primary);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.empty-btn:active {
  background: var(--color-primary-hover);
}

/* ===== Detail Sheet ===== */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.detail-sheet {
  width: 100%;
  background: var(--color-surface);
  border-radius: 20px 20px 0 0;
  padding: 12px 20px 24px;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-text-4);
  opacity: 0.3;
  margin: 0 auto 16px;
}

.detail-header {
  margin-bottom: 20px;
}

.detail-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.detail-status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
}

.detail-status-badge.todo {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.detail-status-badge.in_progress {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.detail-status-badge.done {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.detail-priority-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 8px;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0;
  line-height: 1.3;
}

.detail-meta-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.detail-meta-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.meta-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.meta-label {
  color: var(--color-text-3);
  width: 70px;
  flex-shrink: 0;
}

.meta-value {
  color: var(--color-text-1);
  font-weight: 500;
  flex: 1;
}

.detail-desc {
  margin-bottom: 20px;
  padding: 14px;
  background: var(--color-bg-1);
  border-radius: 12px;
}

.desc-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-3);
  margin: 0 0 8px;
}

.desc-text {
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0;
  line-height: 1.5;
}

.detail-actions {
  display: flex;
  gap: 12px;
}

.detail-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.detail-btn.primary {
  background: var(--color-primary);
  color: white;
}

.detail-btn.primary:active {
  opacity: 0.8;
}

.detail-btn.secondary {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.detail-btn.secondary:active {
  background: var(--color-bg-3);
}
</style>
