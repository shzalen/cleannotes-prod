<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { TaskStatus, TaskPriority, Task, DeletedTask } from '@/types'
import TaskCalendar from '@/components/TaskCalendar.vue'
import TaskRightPanel from '@/components/TaskRightPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = useTaskStore()
const route = useRoute()
const { isDark, isZuru, isTencent } = useTheme()

onMounted(() => store.load())

const selectedDate = ref(toLocalDate())

const filter = ref<TaskStatus | 'all'>('all')

// 从路由 query 读取初始筛选
watch(() => route.query.status, (val) => {
  if (val && ['todo', 'in_progress', 'done', 'all'].includes(val as string)) {
    filter.value = val as TaskStatus | 'all'
  }
}, { immediate: true })

// ---- Stats for center column ----
// 统计逻辑与 TaskRightPanel 日选项卡完全一致，跟随日历选中日期
const todayStr = computed(() => toLocalDate())
const isSelectedToday = computed(() => selectedDate.value === todayStr.value)

const filteredTasks = computed(() => {
  const d = selectedDate.value
  const today = toLocalDate()
  const isToday = d === today

  return store.tasks.filter(t => {
    // 状态筛选
    if (filter.value !== 'all' && t.status !== filter.value) return false
    // 1. 开始日期为选中日期
    if (t.startDate === d) return true
    // 2. 开始日期早于选中日期且未完成（仅当选中今天时）
    if (isToday && t.startDate && t.startDate < d && t.status !== 'done') return true
    // 3. 无开始日期（旧数据）→ 回退到 createdAt 逻辑
    if (!t.startDate) {
      const createdOnDay = t.createdAt.startsWith(d)
      if (isToday) {
        const createdBeforeAndUndone = t.createdAt.slice(0, 10) < d && t.status !== 'done'
        const completedOnDay = t.completedAt && t.completedAt.startsWith(d)
        return createdOnDay || createdBeforeAndUndone || completedOnDay
      }
      return createdOnDay
    }
    return false
  })
})

const todayTotal = computed(() => filteredTasks.value.length)
const todayDone = computed(() => filteredTasks.value.filter(t => t.status === 'done').length)
const todayInProgress = computed(() => filteredTasks.value.filter(t => t.status === 'in_progress').length)
const summaryTitle = computed(() => {
  if (isSelectedToday.value) return '今日任务'
  const [y, m, d] = selectedDate.value.split('-')
  return `${parseInt(m)}月${parseInt(d)}日任务`
})

const todayRate = computed(() => todayTotal.value === 0 ? 0 : Math.round((todayDone.value / todayTotal.value) * 100))

const allTotal = computed(() => store.tasks.length)
const allDone = computed(() => store.doneTasks.length)

// ---- Trash ----
const showTrash = ref(false)

// ---- Trash custom confirm dialogs ----
const permDeleteVisible = ref(false)
const permDeleteTarget = ref<DeletedTask | null>(null)
const emptyTrashVisible = ref(false)

function toggleTrash() {
  showTrash.value = !showTrash.value
}

function handleRestore(item: DeletedTask) {
  store.restoreTask(item.id)
}

function handlePermanentDelete(item: DeletedTask) {
  permDeleteTarget.value = item
  permDeleteVisible.value = true
}

function confirmPermanentDelete() {
  if (permDeleteTarget.value) {
    store.permanentDelete(permDeleteTarget.value.id)
  }
  permDeleteVisible.value = false
  permDeleteTarget.value = null
}

function handleEmptyTrash() {
  emptyTrashVisible.value = true
}

function confirmEmptyTrash() {
  store.emptyTrash()
  emptyTrashVisible.value = false
}

function formatRemainingDays(days: number): string {
  if (days <= 0) return '即将删除'
  if (days === 1) return '1天后删除'
  return `${days}天后删除`
}

// ---- Delete confirm ----
const confirmVisible = ref(false)
const confirmTarget = ref<Task | null>(null)

function requestDelete(task: Task) {
  if (task.status === 'done') return
  confirmTarget.value = task
  confirmVisible.value = true
}

function confirmDelete() {
  if (confirmTarget.value) {
    store.deleteTask(confirmTarget.value.id)
  }
  confirmVisible.value = false
  confirmTarget.value = null
}

function cancelDelete() {
  confirmVisible.value = false
  confirmTarget.value = null
}

// Priority maps
const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}) as Record<TaskPriority, string>)

const priorityLabelMap: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const statusLabelMap: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
}

function cycleStatus(task: Task) {
  store.requestToggleStatus(task.id)
}
</script>

<template>
  <div class="tasks-view">
    <!-- Trash overlay (full width when active) -->
    <template v-if="showTrash">
      <div class="trash-full">
        <div class="trash-full-header">
          <h2 class="tasks-title">回收站</h2>
          <button class="btn-back" @click="toggleTrash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            返回任务
          </button>
          <button v-if="store.trash.length" class="btn-empty-trash" @click="handleEmptyTrash">清空回收站</button>
        </div>
        <p class="trash-hint">删除后 7 天自动永久清除</p>

        <div v-if="store.trash.length === 0" class="tasks-empty">
          回收站为空
        </div>
        <div v-else class="trash-list">
          <div v-for="item in store.trash" :key="item.id" class="trash-item">
            <div class="trash-item-main">
              <span class="trash-item-title" :style="{ color: priorityColorMap[item.priority] }">{{ item.title }}</span>
              <span :class="['card-priority', item.priority]">{{ priorityLabelMap[item.priority] }}</span>
              <span class="trash-remaining" :class="{ urgent: store.getRemainingDays(item.deletedAt) <= 2 }">
                {{ formatRemainingDays(store.getRemainingDays(item.deletedAt)) }}
              </span>
            </div>
            <div class="trash-item-actions">
              <button class="btn-restore" @click="handleRestore(item)" title="恢复任务">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                恢复
              </button>
              <button class="btn-perm-delete" @click="handlePermanentDelete(item)" title="永久删除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                永久删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Normal layout -->
    <template v-else>
      <!-- Skeleton loading -->
      <div v-if="!store.loaded" class="tasks-skeleton">
        <div class="sk-page-header">
          <div class="skeleton-line sk-w-32"></div>
          <div class="skeleton-line sk-w-12"></div>
        </div>
        <div class="sk-layout">
          <div class="sk-calendar">
            <div class="skeleton-line sk-w-24" style="margin-bottom:12px"></div>
            <div class="sk-grid-7">
              <div v-for="i in 35" :key="'cd'+i" class="skeleton-cell sk-cell-sm"></div>
            </div>
          </div>
          <div class="sk-center">
            <div class="skeleton-card">
              <div class="skeleton-line sk-w-16" style="margin-bottom:10px"></div>
              <div class="sk-nums">
                <div class="sk-num-item"><div class="skeleton-line sk-w-8 sk-h-24"></div><div class="skeleton-line sk-w-8 sk-h-10" style="margin-top:4px"></div></div>
                <div class="sk-num-item"><div class="skeleton-line sk-w-8 sk-h-24"></div><div class="skeleton-line sk-w-8 sk-h-10" style="margin-top:4px"></div></div>
                <div class="sk-num-item"><div class="skeleton-line sk-w-8 sk-h-24"></div><div class="skeleton-line sk-w-8 sk-h-10" style="margin-top:4px"></div></div>
              </div>
            </div>
            <div class="skeleton-card" style="margin-top:12px">
              <div class="skeleton-line sk-w-12" style="margin-bottom:10px"></div>
              <div class="sk-nums">
                <div class="sk-num-item"><div class="skeleton-line sk-w-10 sk-h-24"></div><div class="skeleton-line sk-w-8 sk-h-10" style="margin-top:4px"></div></div>
                <div class="sk-num-item"><div class="skeleton-line sk-w-10 sk-h-24"></div><div class="skeleton-line sk-w-8 sk-h-10" style="margin-top:4px"></div></div>
              </div>
            </div>
          </div>
          <div class="sk-right">
            <div class="skeleton-card" style="height:100%">
              <div class="skeleton-line sk-w-20" style="margin-bottom:12px"></div>
              <div v-for="i in 4" :key="'rt'+i" class="skeleton-line sk-w-full" style="margin-bottom:8px; height:28px"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="tasks-title">
            工作任务
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="header-icon">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </h2>
        </div>
        <button class="trash-toggle" @click="toggleTrash" title="回收站">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span v-if="store.trash.length" class="trash-badge">{{ store.trash.length }}</span>
        </button>
      </div>

      <!-- Two-column layout -->
      <div class="tasks-layout">
        <!-- Center column -->
        <div class="center-col">
          <TaskCalendar v-model="selectedDate" :tasks="store.tasks" />

          <!-- Today task summary -->
          <div class="summary-card">
            <div class="summary-title">{{ summaryTitle }}</div>
            <div class="summary-nums">
              <div class="s-num-item">
                <span class="s-num">{{ todayTotal }}</span>
                <span class="s-label">总计</span>
              </div>
              <div class="s-num-item">
                <span class="s-num s-num-success">{{ todayDone }}</span>
                <span class="s-label">完成</span>
              </div>
              <div class="s-num-item">
                <span class="s-num s-num-warning">{{ todayInProgress }}</span>
                <span class="s-label">进行中</span>
              </div>
            </div>
            <div class="summary-bar">
              <div class="summary-fill" :style="{ width: todayRate + '%' }" />
            </div>
          </div>

          <!-- Cumulative stats -->
          <div class="summary-card">
            <div class="summary-title">累计</div>
            <div class="summary-nums">
              <div class="s-num-item">
                <span class="s-num">{{ allTotal }}</span>
                <span class="s-label">总任务</span>
              </div>
              <div class="s-num-item">
                <span class="s-num s-num-success">{{ allDone }}</span>
                <span class="s-label">已完成</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="right-col">
          <TaskRightPanel
            :tasks="store.tasks"
            :selected-date="selectedDate"
            v-model:status-filter="filter"
            @toggle-status="store.toggleStatus"
          />
        </div>
      </div>
    </template>
    </template>

    <!-- Delete confirm dialog (task list) -->
    <ConfirmDialog
      :visible="confirmVisible"
      title="确认删除"
      :message="`确定要删除任务「<strong>${confirmTarget?.title}</strong>」吗？<br/>删除后将移入回收站，7 天后自动永久删除。`"
      confirm-text="确认删除"
      type="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Permanent delete confirm dialog (trash) -->
    <ConfirmDialog
      :visible="permDeleteVisible"
      title="永久删除"
      :message="`确定永久删除「<strong>${permDeleteTarget?.title}</strong>」？<br/>此操作不可恢复。`"
      confirm-text="永久删除"
      type="danger"
      @confirm="confirmPermanentDelete"
      @cancel="permDeleteVisible = false; permDeleteTarget = null"
    />

    <!-- Empty trash confirm dialog -->
    <ConfirmDialog
      :visible="emptyTrashVisible"
      title="清空回收站"
      message="确定清空回收站？所有任务将被永久删除，不可恢复。"
      confirm-text="清空"
      type="danger"
      @confirm="confirmEmptyTrash"
      @cancel="emptyTrashVisible = false"
    />
  </div>
</template>

<script lang="ts">
export default { name: 'TasksView' }
</script>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
}

/* ---- Page header ---- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 8px;
  flex-shrink: 0;
}

.tasks-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: var(--color-text-3);
}

.trash-toggle {
  position: relative;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-3);
  transition: all 0.15s;
}

.trash-toggle:hover {
  border-color: var(--color-text-4);
  color: var(--color-text-2);
}

.trash-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--color-danger);
  color: var(--color-white);
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* ---- Layout ---- */
.tasks-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  padding: 0 24px 24px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.center-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
  min-height: 0;
}

.right-col {
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}

/* ---- Summary cards ---- */
.summary-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 13px 16px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.summary-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
  margin-bottom: 12px;
}

.summary-nums {
  display: flex;
  justify-content: space-around;
  gap: 16px;
}

.s-num-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.s-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-1);
  line-height: 1;
}

.s-num-success {
  color: var(--color-success);
}

.s-num-warning {
  color: var(--color-warning);
}

.s-label {
  font-size: 11px;
  color: var(--color-text-3);
}

.summary-bar {
  margin-top: 12px;
  height: 4px;
  background: var(--color-bg-4);
  border-radius: 999px;
  overflow: hidden;
}

.summary-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 999px;
  transition: width 0.5s ease;
}

/* ---- Trash full ---- */
.trash-full {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.trash-full-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  background: var(--color-bg-3);
  color: var(--color-text-1);
}

.trash-hint {
  font-size: 12px;
  color: var(--color-text-3);
  margin: 4px 0 16px;
}

.btn-empty-trash {
  margin-left: auto;
  font-size: 12px;
  padding: 6px 14px;
  border: 1px solid var(--color-danger);
  background: var(--color-danger-light);
  color: var(--color-danger-text);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-empty-trash:hover {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all 0.15s;
}

.trash-item:hover {
  border-color: var(--color-text-4);
  box-shadow: 0 1px 4px var(--color-shadow);
}

.trash-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.trash-item-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-priority {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}
.card-priority.high { background: var(--color-danger-light); color: var(--color-danger); }
.card-priority.medium { background: var(--color-info-light); color: var(--color-info); }
.card-priority.low { background: var(--color-success-lighter); color: var(--color-success); }

.trash-remaining {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 8px;
  background: var(--color-bg-3);
  color: var(--color-text-3);
  flex-shrink: 0;
}

.trash-remaining.urgent {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.trash-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-restore {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-success);
  background: var(--color-success-lighter);
  color: var(--color-success-text);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-restore:hover {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

.btn-perm-delete {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-danger);
  background: var(--color-danger-light);
  color: var(--color-danger-text);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-perm-delete:hover {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.tasks-empty {
  text-align: center;
  padding: 48px 0;
  font-size: 13px;
  color: var(--color-text-3);
}

/* ===== Skeleton loading ===== */
.tasks-skeleton {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 24px 24px;
  overflow: hidden;
}

.sk-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sk-layout {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.sk-calendar {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 16px;
}

.sk-grid-7 {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.sk-cell-sm {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 3px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.sk-center {
  flex: 1;
  min-width: 0;
}

.sk-right {
  width: 280px;
  flex-shrink: 0;
}

.skeleton-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.sk-nums {
  display: flex;
  justify-content: space-around;
  gap: 16px;
}

.sk-num-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* Shared skeleton primitives */
.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-cell {
  border-radius: 3px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.sk-w-8  { width: 48px; }
.sk-w-10 { width: 64px; }
.sk-w-12 { width: 80px; }
.sk-w-16 { width: 110px; }
.sk-w-20 { width: 140px; }
.sk-w-24 { width: 170px; }
.sk-w-32 { width: 220px; }
.sk-w-full { width: 100%; }
.sk-h-10 { height: 10px; }
.sk-h-24 { height: 24px; }

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

</style>
