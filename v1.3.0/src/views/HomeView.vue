<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { useAuthStore } from '@/stores/auth'
import { toLocalDate } from '@/utils/time'
import { useCompletionCelebration } from '@/composables/useCompletionCelebration'
import GreetingCard from '@/components/GreetingCard.vue'
import StatsCards from '@/components/StatsCards.vue'
import TodayProgress from '@/components/TodayProgress.vue'
import TaskHeatmap from '@/components/TaskHeatmap.vue'
import TaskTrendChart from '@/components/TaskTrendChart.vue'
import CountdownTimer from '@/components/CountdownTimer.vue'
import SpiritIllustration from '@/components/SpiritIllustration.vue'
import CompletionCard from '@/components/CompletionCard.vue'

const store = useTaskStore()
const growth = useGrowthStore()
const auth = useAuthStore()

// 定时刷新：确保 today / 完成率 / 任务列表随时间自动更新
const now = ref(new Date())
let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  store.load()
  growth.load()
  refreshTimer = setInterval(() => { now.value = new Date() }, 30_000)
  // 暴露手动触发入口用于调试
  // @ts-ignore
  window.__celebration = celebration
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const today = computed(() => toLocalDate(now.value))

// 今日任务判定（与 TodayProgress 逻辑保持一致）
const isTodayTask = (t: { startDate: string | null; createdAt: string; status: string; completedAt?: string | null }) => {
  const todayStr = today.value
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

const todayTotal = computed(() => store.tasks.filter(isTodayTask).length)
const todayDone = computed(() => store.tasks.filter(t => isTodayTask(t) && t.status === 'done').length)
const todayRate = computed(() => {
  const total = todayTotal.value
  return total > 0 ? Math.round((todayDone.value / total) * 100) : 0
})

// 今日任务完成庆祝（必须在 todayTotal/todayDone 定义之后）
const celebration = useCompletionCelebration(
  computed(() => todayTotal.value),
  computed(() => todayDone.value),
  computed(() => store.loaded),
  computed(() => auth.user?.id),
)

// Spirit compact display
const xpPercent = computed(() => Math.round(growth.xpProgress * 100))
const stateLabel = computed(() => {
  switch (growth.dailyState) {
    case 'vitality': return '活力'
    case 'recovery': return '复苏'
    case 'withered': return '倦意'
  }
})
const stateColorVar = computed(() => {
  switch (growth.dailyState) {
    case 'vitality': return 'var(--color-success-text)'
    case 'recovery': return 'var(--color-warning-text)'
    case 'withered': return 'var(--color-text-3)'
  }
})
</script>

<template>
  <div class="home">
    <!-- Combined Hero Card: Greeting + Countdown + Spirit -->
    <div class="hero-card">
      <div class="hero-top-row">
        <GreetingCard />
        <div class="hero-right-col">
          <CountdownTimer />
          <!-- Spirit compact — placed below countdown -->
          <div class="hero-spirit-compact" @click="$router.push('/spirit')">
            <div class="hero-spirit-compact-header">
              <span class="hero-spirit-level">Lv.{{ growth.level }}</span>
              <span class="hero-spirit-state" :style="{ color: stateColorVar }">{{ stateLabel }}</span>
              <span v-if="growth.streakDays > 0" class="hero-spirit-streak">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z"/>
                </svg>
                {{ growth.streakDays }}
              </span>
            </div>
            <div class="hero-spirit-compact-bar-wrap">
              <div class="hero-spirit-compact-bar">
                <div class="hero-spirit-fill" :style="{ width: xpPercent + '%' }" />
              </div>
              <span class="hero-spirit-xp">{{ growth.xp }}/{{ growth.xpToNext }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <StatsCards />

    <!-- Progress Bar + Today Tasks -->
    <TodayProgress :rate="todayRate" />

    <!-- Heatmap — 等待 store 加载完毕再渲染，确保响应式数据就绪 -->
    <TaskHeatmap v-if="store.loaded" />
    <div v-else class="skeleton-card skeleton-heatmap">
      <div class="skeleton-header">
        <div class="skeleton-line w-20"></div>
        <div class="skeleton-line w-12"></div>
      </div>
      <div class="skeleton-grid">
        <div v-for="i in 7" :key="'hr'+i" class="skeleton-row">
          <div v-for="j in 12" :key="'hc'+i+'-'+j" class="skeleton-cell"></div>
        </div>
      </div>
    </div>

    <!-- Trend Chart -->
    <TaskTrendChart v-if="store.loaded" />
    <div v-else class="skeleton-card skeleton-chart">
      <div class="skeleton-header">
        <div class="skeleton-line w-20"></div>
      </div>
      <div class="skeleton-chart-area">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" class="skeleton-chart-svg">
          <polyline
            points="0,120 30,90 60,100 90,70 120,85 150,55 180,60 210,40 240,50 270,30 300,35 330,20 360,25 390,15 420,22 450,10 480,18 510,8 540,12 570,5 600,8"
            fill="none"
            stroke="var(--color-border-light)"
            stroke-width="2"
          />
        </svg>
      </div>
    </div>

    <!-- 今日任务全部完成庆祝卡片 -->
    <CompletionCard
      :visible="celebration.visible.value"
      :today-done="todayDone"
      @close="celebration.close"
    />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 28px 28px;
  overflow-y: auto;
  height: 100%;
}

/* Combined Hero Card */
.hero-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

/* Top row: Greeting + Right column (Countdown + Spirit) */
.hero-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

/* Right column: Countdown stacked above Spirit */
.hero-right-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: 140px;
}

/* Spirit compact — sits below countdown */
.hero-spirit-compact {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.hero-spirit-compact:hover {
  opacity: 0.75;
}

.hero-spirit-compact-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero-spirit-level {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-1);
  letter-spacing: -0.02em;
}

.hero-spirit-state {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-bg-3);
}

.hero-spirit-streak {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-warning-text);
  background: var(--color-warning-light);
  padding: 1px 6px;
  border-radius: 10px;
}

/* Compact bar row */
.hero-spirit-compact-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;
}

.hero-spirit-compact-bar {
  width: 110px;
  height: 5px;
  background: var(--color-bg-4);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.hero-spirit-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-warning-text), var(--color-success-text));
  border-radius: 3px;
  transition: width 0.6s ease;
  position: relative;
}

.hero-spirit-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.25), transparent);
}

.hero-spirit-xp {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-3);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .hero-top-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-right-col {
    align-items: flex-start;
    width: 100%;
  }
  .hero-spirit-compact {
    align-items: flex-start;
  }
  .hero-spirit-compact-bar-wrap {
    justify-content: flex-start;
  }
}

/* Skeleton loading */
.skeleton-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.skeleton-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-line.w-20 { width: 120px; }
.skeleton-line.w-12 { width: 60px; }

.skeleton-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-row {
  display: flex;
  gap: 4px;
}

.skeleton-cell {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-chart-area {
  height: 160px;
  position: relative;
  overflow: hidden;
}

.skeleton-chart-svg {
  width: 100%;
  height: 100%;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>
