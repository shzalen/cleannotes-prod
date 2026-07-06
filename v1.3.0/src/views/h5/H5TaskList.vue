<template>
  <div class="h5-page">
    <!-- 顶部头 -->
    <header class="h5-header">
      <div class="h5-header-bg"></div>
      <div class="h5-header-content">
        <h1 class="h5-title">任务</h1>
        <div class="h5-header-stats">
          <div class="h5-stat">
            <span class="h5-stat-num">{{ stats.todo }}</span>
            <span class="h5-stat-label">待办</span>
          </div>
          <div class="h5-stat-divider"></div>
          <div class="h5-stat">
            <span class="h5-stat-num">{{ stats.inProgress }}</span>
            <span class="h5-stat-label">进行中</span>
          </div>
          <div class="h5-stat-divider"></div>
          <div class="h5-stat">
            <span class="h5-stat-num">{{ stats.done }}</span>
            <span class="h5-stat-label">已完成</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 状态筛选 Tab -->
    <div class="h5-filter-bar">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        class="h5-filter-btn"
        :class="{ active: activeFilter === tab.value }"
        @click="activeFilter = tab.value"
      >
        {{ tab.label }}
        <span class="h5-filter-count" v-if="tab.count !== undefined">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 任务列表 -->
    <div class="h5-list" v-if="filteredTasks.length > 0">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="h5-task-card"
        :class="`status-${task.status}`"
        @click="goEdit(task.id)"
      >
        <!-- 左侧状态切换按钮 -->
        <button
          class="h5-task-toggle"
          :class="`toggle-${task.status}`"
          @click.stop="onToggle(task)"
          :disabled="toggling"
        >
          <svg v-if="task.status === 'done'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          <svg v-else-if="task.status === 'in_progress'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
        </button>

        <!-- 任务内容 -->
        <div class="h5-task-body">
          <div class="h5-task-title" :class="{ done: task.status === 'done' }">{{ task.title }}</div>
          <div class="h5-task-meta">
            <span class="h5-priority-badge" :class="`p-${task.priority}`">{{ priorityLabel(task.priority) }}</span>
            <span v-if="task.startDate" class="h5-task-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {{ formatDate(task.startDate) }}{{ task.startTime ? ' ' + task.startTime : '' }}
            </span>
            <span v-if="task.dueDate" class="h5-task-due">
              截止 {{ formatDate(task.dueDate) }}
            </span>
          </div>
        </div>

        <!-- 右侧箭头 -->
        <div class="h5-task-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="h5-empty" v-else-if="!loading">
      <div class="h5-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <p class="h5-empty-text">暂无任务</p>
    </div>

    <!-- 加载中 -->
    <div class="h5-loading" v-if="loading">
      <div class="h5-spinner"></div>
    </div>

    <!-- 浮动新建按钮 -->
    <button class="h5-fab" @click="goNew" aria-label="新建任务">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { useH5Data } from '@/composables/useH5Data'

const router = useRouter()
const { loading, fetchTasks, toggleTaskStatus } = useH5Data()

const tasks = ref<Task[]>([])
const activeFilter = ref<TaskStatus | 'all'>('all')
const toggling = ref(false)

const filterTabs = computed(() => [
  { label: '全部', value: 'all' as const, count: tasks.value.length },
  { label: '待办', value: 'todo' as const, count: tasks.value.filter(t => t.status === 'todo').length },
  { label: '进行中', value: 'in_progress' as const, count: tasks.value.filter(t => t.status === 'in_progress').length },
  { label: '已完成', value: 'done' as const, count: tasks.value.filter(t => t.status === 'done').length },
])

const filteredTasks = computed(() => {
  if (activeFilter.value === 'all') {
    // 排序：进行中 > 待办 > 已完成；同状态内按优先级降序
    const order: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 }
    const prio: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
    return [...tasks.value].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority]
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }
  return tasks.value.filter(t => t.status === activeFilter.value)
})

const stats = computed(() => ({
  todo: tasks.value.filter(t => t.status === 'todo').length,
  inProgress: tasks.value.filter(t => t.status === 'in_progress').length,
  done: tasks.value.filter(t => t.status === 'done').length,
}))

function priorityLabel(p: TaskPriority): string {
  return { low: '低', medium: '中', high: '高' }[p]
}

function formatDate(d: string): string {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

async function loadData() {
  tasks.value = await fetchTasks()
}

async function onToggle(task: Task) {
  toggling.value = true
  try {
    const updated = await toggleTaskStatus(task)
    const idx = tasks.value.findIndex(t => t.id === task.id)
    if (idx >= 0) tasks.value[idx] = updated
  } catch (e) {
    console.error('toggle failed', e)
  } finally {
    toggling.value = false
  }
}

function goNew() {
  router.push('/h5/tasks/new')
}

function goEdit(id: string) {
  router.push(`/h5/tasks/${id}`)
}

onMounted(loadData)
onActivated(loadData)
</script>

<style scoped>
.h5-page {
  min-height: 100%;
}

/* 顶部头部 */
.h5-header {
  position: relative;
  padding: 12px 20px 16px;
  overflow: hidden;
}

.h5-header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, var(--color-accent)) 100%);
  opacity: 0.08;
}

.h5-header-content {
  position: relative;
  z-index: 1;
}

.h5-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.h5-header-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 12px 16px;
  box-shadow: 0 2px 12px var(--color-shadow);
}

.h5-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.h5-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
}

.h5-stat-label {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.h5-stat-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border);
}

/* 筛选栏 */
.h5-filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.h5-filter-bar::-webkit-scrollbar {
  display: none;
}

.h5-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-filter-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.h5-filter-count {
  font-size: 11px;
  opacity: 0.7;
}

/* 任务卡片 */
.h5-list {
  padding: 4px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.h5-task-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px var(--color-shadow);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-task-card:active {
  transform: scale(0.98);
}

.h5-task-card.status-done {
  opacity: 0.65;
}

/* 状态切换按钮 */
.h5-task-toggle {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-task-toggle.toggle-in_progress {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.h5-task-toggle.toggle-done {
  border-color: var(--color-success);
  background: var(--color-success);
  color: #fff;
}

/* 任务内容 */
.h5-task-body {
  flex: 1;
  min-width: 0;
}

.h5-task-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h5-task-title.done {
  text-decoration: line-through;
  color: var(--color-text-3);
}

.h5-task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.h5-priority-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.h5-priority-badge.p-high {
  background: var(--color-danger-light);
  color: var(--color-danger-text);
}

.h5-priority-badge.p-medium {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.h5-priority-badge.p-low {
  background: var(--color-info-light);
  color: var(--color-info-text);
}

.h5-task-time,
.h5-task-due {
  font-size: 11px;
  color: var(--color-text-3);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* 右箭头 */
.h5-task-arrow {
  flex-shrink: 0;
  color: var(--color-text-4);
}

/* 空状态 */
.h5-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--color-text-4);
}

.h5-empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

.h5-empty-text {
  font-size: 14px;
  margin: 0;
}

/* 加载中 */
.h5-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.h5-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: h5-spin 0.7s linear infinite;
}

@keyframes h5-spin {
  to { transform: rotate(360deg); }
}

/* 浮动按钮 */
.h5-fab {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  right: 20px;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 40%, transparent);
  z-index: 50;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-fab:active {
  transform: scale(0.92);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
</style>
