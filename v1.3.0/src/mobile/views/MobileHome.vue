<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useAuthStore } from '@/stores/auth'
import { filterTodayTasks, sortTasks } from '@/utils/todayTasks'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { showToast } from 'vant'

defineOptions({ name: 'MobileHome' })

const taskStore = useTaskStore()
const auth = useAuthStore()

const todayStr = computed(() => toLocalDate())

const todayDate = computed(() => {
  const d = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const m = d.getMonth() + 1
  const day = d.getDate()
  const w = weekdays[d.getDay()]
  return `${m}月${day}日 ${w}`
})

const todayTasks = computed(() => {
  const filtered = filterTodayTasks(taskStore.tasks, todayStr.value)
  return sortTasks(filtered)
})

const doneCount = computed(() => todayTasks.value.filter((t) => t.status === 'done').length)
const totalCount = computed(() => todayTasks.value.length)
const progress = computed(() => (totalCount.value === 0 ? 0 : Math.round((doneCount.value / totalCount.value) * 100)))

const nickname = computed(() => auth.user?.nickname || '用户')

function toggleTask(task: Task) {
  taskStore.requestToggleStatus(task.id)
}

const priorityMeta: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--color-danger)' },
  medium: { label: '中', color: 'var(--color-warning)' },
  low: { label: '低', color: 'var(--color-success)' },
}

// 快速添加任务
const showQuickAdd = ref(false)
const quickTitle = ref('')

function openQuickAdd() {
  quickTitle.value = ''
  showQuickAdd.value = true
}

function confirmQuickAdd() {
  const title = quickTitle.value.trim()
  if (!title) {
    showToast('请输入任务标题')
    return
  }
  taskStore.addTask({
    title,
    startDate: todayStr.value,
  })
  showQuickAdd.value = false
  showToast('已添加')
}
</script>

<template>
  <div class="home-page">
    <!-- 沉浸式头部：背景跟随主题色 -->
    <header class="home-header">
      <div class="home-header__content">
        <div class="home-header__top">
          <div>
            <h1 class="home-header__title">清记</h1>
            <p class="home-header__date">{{ todayDate }}</p>
          </div>
          <div class="home-header__user">{{ nickname }}</div>
        </div>

        <!-- 进度条：半透明卡片 -->
        <div class="home-header__progress">
          <div class="home-header__progress-row">
            <span class="home-header__progress-label">今日完成率</span>
            <span class="home-header__progress-percent">{{ progress }}%</span>
          </div>
          <div class="home-header__progress-bar">
            <div class="home-header__progress-fill" :style="{ width: progress + '%' }" />
          </div>
        </div>
      </div>
    </header>

    <!-- 任务列表 -->
    <div class="home-content">
      <template v-if="todayTasks.length > 0">
        <div class="task-list">
          <div
            v-for="task in todayTasks"
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

      <!-- 空状态 -->
      <div v-else class="home-empty">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="10" y="14" width="44" height="40" rx="6" />
          <path d="M10 26h44M22 8v12M42 8v12" />
          <path d="M22 40l6 6 12-12" stroke="var(--color-primary)" />
        </svg>
        <p class="home-empty__text">今日暂无任务</p>
        <p class="home-empty__hint">点击右下角按钮添加</p>
      </div>
    </div>

    <!-- 快速添加 FAB -->
    <button class="home-fab" @click="openQuickAdd">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <!-- 底部上滑快速添加弹窗 -->
    <van-popup
      v-model:show="showQuickAdd"
      position="bottom"
      round
      teleport="body"
      :style="{ '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="quick-add-sheet">
        <div class="quick-add-sheet__header">
          <span class="quick-add-sheet__title">快速添加任务</span>
          <button class="quick-add-sheet__close" @click="showQuickAdd = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="quick-add-sheet__body">
          <van-field
            v-model="quickTitle"
            placeholder="输入任务标题..."
            clearable
            autofocus
            @keyup.enter="confirmQuickAdd"
          />
        </div>
        <div class="quick-add-sheet__footer">
          <van-button block round type="primary" @click="confirmQuickAdd">添加</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-1);
}

/* ── 沉浸式头部 ── */
.home-header {
  flex-shrink: 0;
  background: var(--color-primary);
  /* 让背景延伸到屏幕最顶部，覆盖状态栏区域 */
  padding-top: var(--safe-top);
}

.home-header__content {
  padding: 0 16px 16px;
}

.home-header__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}

.home-header__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.home-header__date {
  margin: 2px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.home-header__user {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  padding-bottom: 2px;
}

.home-header__progress {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 10px 12px;
}

.home-header__progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.home-header__progress-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.home-header__progress-percent {
  font-size: 13px;
  color: #fff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-header__progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  overflow: hidden;
}

.home-header__progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* ── 内容区 ── */
.home-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 80px;
}

/* ── 任务列表 ── */
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

/* ── 空状态 ── */
.home-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--color-text-3);
}

.home-empty svg {
  width: 56px;
  height: 56px;
  color: var(--color-text-3);
  opacity: 0.5;
  margin-bottom: 12px;
}

.home-empty__text {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.home-empty__hint {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.7;
}

/* ── FAB ── */
.home-fab {
  position: absolute;
  right: 16px;
  bottom: calc(var(--tabbar-height) + var(--safe-bottom) + 16px);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 40%, rgba(0, 0, 0, 0.2));
  cursor: pointer;
  z-index: 15;
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.home-fab:active {
  transform: scale(0.9);
}

.home-fab svg {
  width: 22px;
  height: 22px;
}

/* ── 底部弹窗 ── */
.quick-add-sheet {
  background: var(--color-surface);
  padding-bottom: var(--safe-bottom);
}

.quick-add-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.quick-add-sheet__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.quick-add-sheet__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
}

.quick-add-sheet__close svg {
  width: 20px;
  height: 20px;
}

.quick-add-sheet__body {
  padding: 12px 4px 0;
}

.quick-add-sheet__footer {
  padding: 12px 16px 16px;
}
</style>
