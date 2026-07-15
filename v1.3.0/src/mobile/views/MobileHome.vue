<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useAuthStore } from '@/stores/auth'
import { filterTodayTasks, sortTasks } from '@/utils/todayTasks'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { showToast } from 'vant'
import { useTouchInteraction } from '../composables/useTouchInteraction'

import MobileGreetingCard from '../components/MobileGreetingCard.vue'
import MobileTaskDetailPopup from '../components/MobileTaskDetailPopup.vue'
import MobileTaskProgressPopup from '../components/MobileTaskProgressPopup.vue'
import MobileTaskEditPopup from '../components/MobileTaskEditPopup.vue'

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

const priorityMeta: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--color-danger)' },
  medium: { label: '中', color: 'var(--color-warning)' },
  low: { label: '低', color: 'var(--color-success)' },
}

// ── 下拉刷新 ──
const refreshing = ref(false)

async function onRefresh() {
  await taskStore.load(true)
  refreshing.value = false
}

// ── 弹窗引用 ──
const detailPopup = ref<InstanceType<typeof MobileTaskDetailPopup> | null>(null)
const progressPopup = ref<InstanceType<typeof MobileTaskProgressPopup> | null>(null)
const editPopup = ref<InstanceType<typeof MobileTaskEditPopup> | null>(null)

// ── 统一触控交互（位移阈值防误触） ──
const { handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchInteraction<Task>({
  onTap: (task) => detailPopup.value?.open(task),
  onLongPress: (task) => progressPopup.value?.open(task),
})

// ── 任务创建 ──
function openTaskCreate() {
  editPopup.value?.openNew()
}
</script>

<template>
  <div class="home-page">
    <!-- 沉浸式头部：问候语 + 日期 + 随机语 -->
    <header class="home-header">
      <div class="home-header__content">
        <!-- 顶部行 -->
        <div class="home-header__top">
          <div>
            <h1 class="home-header__title">清记</h1>
          </div>
          <div class="home-header__user">{{ nickname }}</div>
        </div>

        <!-- 问候语卡片区域（原完成率位置） -->
        <div class="home-header__greeting">
          <MobileGreetingCard />
        </div>
      </div>
    </header>

    <!-- 内容区（含完成率 + 任务列表） -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="home-pull-refresh">
    <div class="home-content" id="home-content-scroll">
      <!-- 今日完成率（移到任务列表前） -->
      <div class="home-progress">
        <div class="home-progress__row">
          <span class="home-progress__label">今日完成率</span>
          <span class="home-progress__percent">{{ progress }}%</span>
        </div>
        <div class="home-progress__bar">
          <div class="home-progress__fill" :style="{ width: progress + '%' }" />
        </div>
        <div class="home-progress__info">
          <span>{{ doneCount }}/{{ totalCount }} 已完成</span>
        </div>
      </div>

      <!-- 任务列表 -->
      <template v-if="todayTasks.length > 0">
        <div class="task-list">
          <div
            v-for="task in todayTasks"
            :key="task.id"
            class="task-item"
            :class="{ 'is-done': task.status === 'done' }"
            @touchstart.passive="handleTouchStart(task, $event)"
            @touchend.passive="handleTouchEnd()"
            @touchmove.passive="handleTouchMove($event)"
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
                <span v-if="task.dueDate" class="task-item__due">{{ task.dueDate }}</span>
              </div>
            </div>

            <!-- 右箭头提示 -->
            <span class="task-item__arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
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

      <!-- 底部留白 -->
      <div class="home-bottom-spacer" />
    </div>
    </van-pull-refresh>

    <!-- 快速创建 FAB -->
    <button class="home-fab" @click="openTaskCreate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <!-- 任务详情弹窗 -->
    <MobileTaskDetailPopup ref="detailPopup" />

    <!-- 进度更新弹窗 -->
    <MobileTaskProgressPopup ref="progressPopup" />

    <!-- 完整任务创建弹窗 -->
    <MobileTaskEditPopup ref="editPopup" />
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-1);
}

/* ── 沉浸式头部（含问候语） ── */
.home-header {
  flex-shrink: 0;
  background: var(--color-primary);
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

.home-header__user {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  padding-bottom: 2px;
}

.home-header__greeting {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px 14px;
}

/* ── 内容区 ── */
.home-pull-refresh {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 80px;
}

/* ── 今日完成率卡片 ── */
.home-progress {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.home-progress__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.home-progress__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.home-progress__percent {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.home-progress__bar {
  height: 6px;
  background: var(--color-bg-3);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.home-progress__fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.home-progress__info {
  font-size: 12px;
  color: var(--color-text-3);
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
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
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

.task-item__due {
  font-size: 11px;
  color: var(--color-text-4);
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
  position: fixed;
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

/* ── 底部留白 ── */
.home-bottom-spacer {
  height: 16px;
}
</style>
