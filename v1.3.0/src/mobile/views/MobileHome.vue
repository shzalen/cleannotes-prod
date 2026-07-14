<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { Task, TaskPriority } from '@/types'
import { PullRefresh as VanPullRefresh, CellGroup as VanCellGroup, Cell as VanCell, Tag as VanTag, Empty as VanEmpty, Progress as VanProgress } from 'vant'
import TaskDetailSheet from '@/mobile/components/TaskDetailSheet.vue'
import TaskProgressSheet from '@/mobile/components/TaskProgressSheet.vue'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const today = computed(() => toLocalDate(now.value))

const dateDisplay = computed(() => {
  const d = now.value
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${wd[d.getDay()]}`
})

// ── 今日任务过滤（对齐 PC 端 TodayProgress.vue） ──
const todayTasks = computed(() =>
  store.tasks.filter(t => {
    const ts = today.value
    if (t.startDate === ts) return true
    if (t.startDate && t.startDate < ts && t.status !== 'done') return true
    if (!t.startDate) {
      const cd = t.createdAt.startsWith(ts)
      const cb = t.createdAt.slice(0, 10) < ts && t.status !== 'done'
      const cp = t.completedAt && t.completedAt.startsWith(ts)
      return cd || cb || cp
    }
    if (t.completedAt && t.completedAt.startsWith(ts)) return true
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
  return Math.round((sortedTasks.value.filter(t => t.status === 'done').length / total) * 100)
})

function formatDate(s: string) { return s.slice(5, 10) }

function timeLabel(task: Task) {
  if (task.status === 'done') return task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : ''
  return task.startTime || '--:--'
}

function isFutureTask(task: Task) {
  if (task.startDate) return task.startDate > today.value
  return task.createdAt.slice(0, 10) > today.value
}

const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }

const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}))

const priorityLabelMap: Record<TaskPriority, string> = { high: '高', medium: '中', low: '低' }

// ── 下拉刷新 ──
const refreshing = ref(false)
async function onRefresh() {
  try { await store.load(true); now.value = new Date() } finally { refreshing.value = false }
}

// ── 弹窗 ──
const detailSheet = ref<InstanceType<typeof TaskDetailSheet> | null>(null)
const progressSheet = ref<InstanceType<typeof TaskProgressSheet> | null>(null)

function showDetail(task: Task) { detailSheet.value?.open(task) }
function openProgress(task: Task) { if (!isFutureTask(task)) progressSheet.value?.open(task) }
</script>

<template>
  <div class="home-page">
    <!-- 蓝色渐变头部，延伸到状态栏 -->
    <div class="home-header">
      <div class="header-content">
        <div class="header-top">
          <h1 class="header-title">清记</h1>
          <div class="header-badge">
            <span class="badge-num">{{ sortedTasks.length }}</span>
            <span class="badge-label">今日</span>
          </div>
        </div>
        <p class="header-date">{{ dateDisplay }}</p>
      </div>
    </div>

    <!-- 圆角白色内容区 -->
    <div class="content-wrapper">
      <VanPullRefresh v-model="refreshing" @refresh="onRefresh" class="home-scroll">
        <div class="content-area">
          <!-- 完成率卡片 -->
          <div class="progress-card">
            <div class="progress-top">
              <span class="progress-label">今日完成率</span>
              <span class="progress-value">{{ rate }}%</span>
            </div>
            <VanProgress :percentage="rate" :show-pivot="false" color="var(--color-primary)" stroke-width="6" />
          </div>

          <!-- 任务列表 -->
          <VanCellGroup v-if="sortedTasks.length" inset class="task-group">
            <VanCell
              v-for="task in sortedTasks"
              :key="task.id"
              class="task-cell"
              :class="{ 'is-done': task.status === 'done' }"
              clickable
              @click="showDetail(task)"
            >
              <template #icon>
                <div
                  class="task-dot"
                  :class="task.status"
                  @click.stop="openProgress(task)"
                />
              </template>
              <template #title>
                <span class="task-time">{{ timeLabel(task) }}</span>
              </template>
              <template #value>
                <div class="task-value">
                  <span class="task-title" :class="task.status">{{ task.title }}</span>
                  <div class="task-tags">
                    <VanTag plain :type="task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'primary' : 'success'" size="mini">
                      {{ priorityLabelMap[task.priority] }}
                    </VanTag>
                  </div>
                </div>
              </template>
              <template #right-icon>
                <VanTag v-if="task.status !== 'done'" :type="task.status === 'in_progress' ? 'warning' : 'default'" size="mini" @click.stop="openProgress(task)">
                  {{ statusLabel[task.status] }}
                </VanTag>
              </template>
            </VanCell>
          </VanCellGroup>

          <VanEmpty v-else description="今日暂无任务" />
        </div>
      </VanPullRefresh>
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

/* ── 蓝色渐变头部，延伸到状态栏 ── */
.home-header {
  background: linear-gradient(135deg, #4a90d9 0%, #0052D9 100%);
  padding-top: max(env(safe-area-inset-top, 0px), 28px);
  padding-bottom: 24px;
  flex-shrink: 0;
  position: relative;
}

/* 底部圆角过渡 */
.home-header::after {
  content: '';
  position: absolute;
  bottom: -16px;
  left: 0; right: 0;
  height: 32px;
  background: var(--color-bg-0, #fff);
  border-radius: 16px 16px 0 0;
}

.header-content {
  padding: 0 20px;
  position: relative;
  z-index: 1;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
}

.header-badge {
  display: flex;
  align-items: baseline;
  gap: 4px;
  background: rgba(255,255,255,0.2);
  padding: 6px 14px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.badge-num {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.badge-label {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
}

.header-date {
  font-size: 16px;
  color: rgba(255,255,255,0.85);
  margin-top: 6px;
}

/* ── 白色内容区 ── */
.content-wrapper {
  flex: 1;
  background: var(--color-bg-0, #fff);
  border-radius: 16px 16px 0 0;
  margin-top: -16px;
  position: relative;
  z-index: 2;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.home-scroll {
  flex: 1;
  overflow-y: auto;
}

.content-area {
  padding: 16px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

/* ── 完成率卡片 ── */
.progress-card {
  margin: 0 16px 16px;
  padding: 16px 18px;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.progress-top {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}

.progress-label { font-size: 16px; font-weight: 500; color: var(--color-text-2); }
.progress-value { font-size: 18px; font-weight: 700; color: var(--color-primary); }

/* ── 任务列表 ── */
.task-group { margin: 0 16px; }

.task-cell {
  align-items: center;
  padding: 14px 16px;
}

.task-cell.is-done { opacity: 0.6; }

.task-dot {
  width: 12px; height: 12px; border-radius: 50%;
  margin-right: 12px; flex-shrink: 0;
}

.task-dot.todo { background: var(--color-text-4); }
.task-dot.in_progress { background: var(--color-warning); }
.task-dot.done { background: var(--color-primary); }

.task-time {
  font-size: 15px; font-weight: 600; color: var(--color-text-2);
  font-variant-numeric: tabular-nums; min-width: 40px; display: inline-block;
}

.task-value {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-end; text-align: right;
}

.task-title {
  font-size: 18px; font-weight: 500; color: var(--color-text-1);
}

.task-title.done { text-decoration: line-through; color: var(--color-text-3); }

.task-tags { display: flex; gap: 4px; }
</style>
