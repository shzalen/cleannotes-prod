<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { TaskStatus } from '@/types'

const store = useTaskStore()
const router = useRouter()

const today = toLocalDate()

// 今日任务判定：与 HomeView / TodayProgress 逻辑保持一致
const isTodayTask = (t: { startDate: string | null; createdAt: string; status: string; completedAt?: string | null }) => {
  const todayStr = today
  // 1. 开始日期为当天 → 计划任务
  if (t.startDate === todayStr) return true
  // 2. 开始日期早于当天且未完成 → 延迟任务
  if (t.startDate && t.startDate < todayStr && t.status !== 'done') return true
  // 3. 无开始日期（旧数据/未规划）→ 回退到 createdAt 逻辑
  if (!t.startDate) {
    const createdOnDay = t.createdAt.startsWith(todayStr)
    const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr && t.status !== 'done'
    const completedOnDay = t.completedAt != null && t.completedAt.startsWith(todayStr)
    return createdOnDay || createdBeforeAndUndone || completedOnDay
  }
  return false
}

// P-11: Single-pass computation — iterate tasks once instead of 4 separate filters
const todayCount = computed(() => store.tasks.filter(isTodayTask).length)
const taskCounts = computed(() => {
  let done = 0, inProgress = 0, todo = 0
  for (const t of store.tasks) {
    if (t.status === 'done') done++
    else if (t.status === 'in_progress') inProgress++
    else if (t.status === 'todo') todo++
  }
  return { done, inProgress, todo }
})
const doneCount = computed(() => taskCounts.value.done)
const inProgressCount = computed(() => taskCounts.value.inProgress)
const todoCount = computed(() => taskCounts.value.todo)

const stats = computed(() => [
  {
    label: '今日任务',
    value: todayCount.value,
    icon: 'tasks',
    color: 'blue',
    filter: 'all' as const,
  },
  {
    label: '已完成',
    value: doneCount.value,
    icon: 'check',
    color: 'green',
    filter: 'done' as TaskStatus,
  },
  {
    label: '进行中',
    value: inProgressCount.value,
    icon: 'clock',
    color: 'blue',
    filter: 'in_progress' as TaskStatus,
  },
  {
    label: '待处理',
    value: todoCount.value,
    icon: 'doc',
    color: 'orange',
    filter: 'todo' as TaskStatus,
  },
])

// ===== 动画效果 =====
const plusOneIndex = ref<number | null>(null)
const pulsingIndex = ref<number | null>(null)

interface Particle {
  id: number
  dx: string
  dy: string
  delay: string
  color: string
  size: string
}

const effectParticles = ref<Particle[]>([])

// Hover 粒子（独立体系，不与点击动效冲突）
const hoverParticlesIndex = ref<number | null>(null)
const hoverParticles = ref<Particle[]>([])

const colorPalettes: Record<string, string[]> = {
  green: ['var(--color-success)', 'var(--color-success-light)', '#4ade80', '#22c55e'],
  blue: ['var(--color-info)', 'var(--color-info-light)', '#60a5fa', '#3b82f6'],
  orange: ['var(--color-warning)', 'var(--color-warning-light)', '#fbbf24', '#f59e0b'],
}

function generateParticles(color: string): Particle[] {
  const palette = colorPalettes[color] || colorPalettes.green
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    dx: `${(Math.random() - 0.5) * 110}px`,
    dy: `${Math.random() * -65 - 15}px`,
    delay: `${Math.random() * 0.22}s`,
    color: palette[Math.floor(Math.random() * palette.length)],
    size: `${3.5 + Math.random() * 6}px`,
  }))
}

function generateHoverParticles(color: string): Particle[] {
  const palette = colorPalettes[color] || colorPalettes.green
  return Array.from({ length: 10 }, (_, i) => ({
    id: i,
    dx: `${(Math.random() - 0.5) * 80}px`,
    dy: `${Math.random() * -45 - 8}px`,
    delay: `${Math.random() * 0.15}s`,
    color: palette[Math.floor(Math.random() * palette.length)],
    size: `${2.5 + Math.random() * 4}px`,
  }))
}

function triggerEffect(index: number, color: string) {
  // 避免短时间内重复触发
  if (plusOneIndex.value !== null) return
  plusOneIndex.value = index
  pulsingIndex.value = index
  effectParticles.value = generateParticles(color)

  setTimeout(() => {
    plusOneIndex.value = null
    pulsingIndex.value = null
  }, 900)
}

// 跟踪上一次值，防止挂载时触发
let prevToday = 0
let prevDone = 0
let prevInProgress = 0
let prevTodo = 0
let mounted = false

onMounted(() => {
  nextTick(() => {
    prevToday = todayCount.value
    prevDone = doneCount.value
    prevInProgress = inProgressCount.value
    prevTodo = todoCount.value
    mounted = true
  })
})

watch(todayCount, (nv) => {
  if (!mounted || nv <= prevToday) { prevToday = nv; return }
  prevToday = nv
  triggerEffect(0, 'blue')
})

watch(doneCount, (nv) => {
  if (!mounted || nv <= prevDone) { prevDone = nv; return }
  prevDone = nv
  triggerEffect(1, 'green')
})

watch(inProgressCount, (nv) => {
  if (!mounted || nv <= prevInProgress) { prevInProgress = nv; return }
  prevInProgress = nv
  triggerEffect(2, 'blue')
})

watch(todoCount, (nv) => {
  if (!mounted || nv <= prevTodo) { prevTodo = nv; return }
  prevTodo = nv
  triggerEffect(3, 'orange')
})

function goToTasks(filter: string) {
  router.push({ name: 'tasks', query: { status: filter } })
}

// Hover 粒子
function onCardMouseEnter(index: number, color: string) {
  hoverParticlesIndex.value = index
  hoverParticles.value = generateHoverParticles(color)
}

function onCardMouseLeave() {
  hoverParticlesIndex.value = null
}
</script>

<template>
  <div class="stats-row">
    <div
      v-for="(s, i) in stats"
      :key="i"
      class="stat-card clickable"
      :class="{ 'stat-card--pulse': pulsingIndex === i }"
      @click="goToTasks(s.filter)"
      @mouseenter="onCardMouseEnter(i, s.color)"
      @mouseleave="onCardMouseLeave"
    >
      <!-- 粒子容器（点击动效） -->
      <span
        v-for="p in (pulsingIndex === i ? effectParticles : [])"
        :key="p.id"
        class="stat-particle"
        :style="{
          '--dx': p.dx,
          '--dy': p.dy,
          '--delay': p.delay,
          '--color': p.color,
          '--size': p.size,
        }"
      />
      <!-- 粒子容器（hover 动效） -->
      <span
        v-for="p in (hoverParticlesIndex === i ? hoverParticles : [])"
        :key="'h' + p.id"
        class="stat-particle stat-particle--hover"
        :style="{
          '--dx': p.dx,
          '--dy': p.dy,
          '--delay': p.delay,
          '--color': p.color,
          '--size': p.size,
        }"
      />

      <div class="stat-icon" :class="s.color">
        <!-- Tasks -->
        <svg v-if="s.icon === 'tasks'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <!-- Check -->
        <svg v-else-if="s.icon === 'check'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <!-- Clock -->
        <svg v-else-if="s.icon === 'clock'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <!-- Doc -->
        <svg v-else-if="s.icon === 'doc'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">
          {{ s.value }}
          <!-- +1 浮动 -->
          <span v-if="plusOneIndex === i" class="stat-plus-one">+1</span>
        </div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px var(--color-shadow);
  position: relative;
  overflow: hidden;
}

.stat-card.clickable {
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.stat-card.clickable:hover {
  box-shadow: 0 4px 12px var(--color-shadow-md);
  transform: translateY(-2px);
}

/* 卡片脉冲 */
.stat-card--pulse {
  animation: card-pulse 0.35s ease;
}

@keyframes card-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.03); }
  100% { transform: scale(1); }
}

/* 粒子 */
.stat-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: var(--color);
  animation: particle-burst 0.7s var(--delay) ease-out both;
  pointer-events: none;
  z-index: 2;
}

@keyframes particle-burst {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  60% {
    opacity: 0.7;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(0.2);
    opacity: 0;
  }
}

/* Hover 粒子：更轻量、浮现感 */
.stat-particle--hover {
  animation: particle-float 0.85s var(--delay) ease-out both;
}

@keyframes particle-float {
  0% {
    transform: translate(0, 0) scale(0.4);
    opacity: 0;
  }
  25% {
    transform: translate(calc(var(--dx) * 0.35), calc(var(--dy) * 0.35)) scale(1);
    opacity: 0.75;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(0.15);
    opacity: 0;
  }
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.stat-icon.green {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.stat-icon.blue {
  background: var(--color-info-light);
  color: var(--color-info-text);
}

.stat-icon.orange {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  z-index: 1;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1;
  position: relative;
}

/* +1 浮动 */
.stat-plus-one {
  position: absolute;
  top: -8px;
  right: -12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-success-text);
  animation: float-up 0.75s ease-out both;
  pointer-events: none;
  z-index: 3;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scale(0.85);
    opacity: 1;
  }
  60% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-28px) scale(1.15);
    opacity: 0;
  }
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-3);
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
