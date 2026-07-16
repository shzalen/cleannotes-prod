<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useAuthStore } from '@/stores/auth'
import { filterTodayTasks, sortTasks } from '@/utils/todayTasks'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { useTouchInteraction } from '../composables/useTouchInteraction'
import { useTabRefresh } from '../composables/useTabRefresh'
import { playDingSound } from '../composables/useSound'

import MobileGreetingCard from '../components/MobileGreetingCard.vue'
import MobileTaskDetailPopup from '../components/MobileTaskDetailPopup.vue'
import MobileTaskProgressPopup from '../components/MobileTaskProgressPopup.vue'
import MobileTaskEditPopup from '../components/MobileTaskEditPopup.vue'
import { PullRefresh as VanPullRefresh, showConfirmDialog, showToast } from 'vant'

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

// ── 时段问候语（移到头部标题栏） ──
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

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

// ── 弹窗引用 ──
const detailPopup = ref<InstanceType<typeof MobileTaskDetailPopup> | null>(null)
const progressPopup = ref<InstanceType<typeof MobileTaskProgressPopup> | null>(null)
const editPopup = ref<InstanceType<typeof MobileTaskEditPopup> | null>(null)

// ── 统一触控交互（800ms 长按 + 进度条） ──
const { handleTouchStart, handleTouchMove, handleTouchEnd, pressingTask, progressPercent } = useTouchInteraction<Task>({
  onTap: (task) => detailPopup.value?.open(task),
  onLongPress: (task) => {
    // 已完成任务 → 弹出重新激活确认框（同 PC 端逻辑）
    if (task.status === 'done') {
      showConfirmDialog({
        title: '重新激活任务',
        message: `将已完成任务「${task.title}」重新激活为待办？\n激活后将保留历史耗时记录，重新开始执行时会刷新计时。`,
        confirmButtonText: '确认激活',
        cancelButtonText: '取消',
        confirmButtonColor: '#0052D9',
      }).then(() => {
        taskStore.toggleStatus(task.id)
        showToast('任务已重新激活')
      }).catch(() => {})
      return
    }
    // 非已完成 → 打开进度更新弹窗
    progressPopup.value?.open(task)
  },
  longPressMs: 800,
})

// ── 下拉刷新 ──
const refreshing = ref(false)
const { refreshCounter, triggerRefresh } = useTabRefresh()

async function doRefresh() {
  refreshing.value = true
  await taskStore.load(true)
  refreshing.value = false
  playDingSound()
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

// ── 任务创建 ──
function openTaskCreate() {
  editPopup.value?.openNew()
}

// ── 从详情弹窗跳转编辑 ──
function handleEditFromDetail(task: Task) {
  editPopup.value?.openEdit(task)
}
</script>

<template>
  <div class="home-page">
    <!-- 沉浸式头部：问候语 + 日期 + 随机语 -->
    <header class="home-header">
      <!-- 背景气泡装饰：仅显示在头部蓝色区域 -->
      <div class="home-bubbles" aria-hidden="true">
        <span class="bubble bubble--1" />
        <span class="bubble bubble--2" />
        <span class="bubble bubble--3" />
        <span class="bubble bubble--4" />
        <span class="bubble bubble--5" />
      </div>

      <div class="home-header__safe-area" />
      <div class="home-header__content">
        <!-- 顶部行 -->
        <div class="home-header__top">
          <h1 class="home-header__title">{{ greeting }}，{{ nickname }}</h1>
        </div>

        <!-- 问候语卡片区域（原完成率位置） -->
        <div class="home-header__greeting">
          <MobileGreetingCard />
        </div>
      </div>
    </header>

    <!-- 内容区（含完成率 + 任务列表） — 下拉刷新 + 原生滚动 -->
    <van-pull-refresh
      v-model="refreshing"
      class="home-pull-refresh"
      @refresh="onRefresh"
    >
      <div class="home-content">
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
            :class="{ 'is-done': task.status === 'done', 'is-pressing': pressingTask === task }"
            @touchstart.passive="handleTouchStart(task, $event)"
            @touchend.passive="handleTouchEnd()"
            @touchmove.passive="handleTouchMove($event)"
          >
            <!-- 长按进度条：800ms 填充完成即打开弹窗 -->
            <div
              v-if="pressingTask === task"
              class="task-item__press-bar"
              :style="{ width: progressPercent + '%' }"
            />
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
    <MobileTaskDetailPopup ref="detailPopup" @edit="handleEditFromDetail" />

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
  flex: 1;
  min-height: 0;
  /* overflow: hidden 会裁剪内部滚动容器的橡皮筋回弹效果；
     m-layout__body 已做 overflow:hidden 防止穿透 */
  background: var(--color-bg-1);
}

/* ── 沉浸式头部（含问候语） ── */
.home-header {
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary) 80%, #fff 20%) 0%,
    var(--color-primary) 45%,
    color-mix(in srgb, var(--color-primary) 85%, #000 15%) 100%
  );
  position: relative;
  z-index: 1;
}

.home-header__safe-area {
  height: var(--safe-top);
  position: relative;
  z-index: 1;
}

.home-header__content {
  padding: 0 16px 20px;
  position: relative;
  z-index: 1;
}

/* ── 头部气泡装饰（固定位置 + 微微漂移） ── */
.home-bubbles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.32),
    rgba(255, 255, 255, 0.10) 50%,
    transparent 80%
  );
  border: 1px solid rgba(255, 255, 255, 0.15);
  opacity: 0.5;
  filter: blur(0.5px);
  animation: bubble-drift ease-in-out infinite alternate;
}

.bubble--1 { top: 6%;  left: 50%; width: 72px; height: 72px; animation-duration: 8s;  animation-delay: 0s;   --dx: 10px; --dy: -8px; }
.bubble--2 { top: 50%; left: 86%; width: 32px; height: 32px; animation-duration: 5s;  animation-delay: 1.2s; --dx: -7px; --dy: 8px; }
.bubble--3 { top: 25%; left: 65%; width: 20px; height: 20px; animation-duration: 4.5s; animation-delay: 0.6s; --dx: 6px;  --dy: 5px; }
.bubble--4 { top: 68%; left: 75%; width: 48px; height: 48px; animation-duration: 7s;  animation-delay: 2s;   --dx: -5px; --dy: -7px; }
.bubble--5 { top: 4%;  left: 38%; width: 16px; height: 16px; animation-duration: 5.5s; animation-delay: 1.8s; --dx: 7px;  --dy: 6px; }

@keyframes bubble-drift {
  0% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(var(--dx), var(--dy));
  }
  100% {
    transform: translate(calc(var(--dx) * -0.5), calc(var(--dy) * -0.8));
  }
}

.home-header__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16px;
}

.home-header__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

.home-header__greeting {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px 14px;
  position: relative;
  z-index: 1;
}

/* ── 下拉刷新容器 ── */
.home-pull-refresh {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  overscroll-behavior-y: auto; /* 恢复 iOS 橡皮筋效果 */
  -webkit-overflow-scrolling: touch;
}

/* ── 内容区（原生滚动 + 阻尼效果） ── */
.home-content {
  min-height: 100%;
  padding: 12px 12px 0;
  touch-action: pan-y; /* 确保垂直滑动手势正确传递 */
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
  position: relative;
  overflow: hidden;
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

/* 长按进度条 — 顶部边框线从左到右填充 */
.task-item__press-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--color-primary);
  border-radius: 12px 0 0 0;
  z-index: 2;
  pointer-events: none;
  will-change: width;
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

/* 已完成 → 绿色（主色填充） */
.task-item__check.done {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

/* 到点脉冲线圈 — 与 PC 端 TodayProgress 一致 */
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
  bottom: calc(var(--tabbar-height) + 16px);
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
  z-index: 16;
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
  height: 8px;
}
</style>
