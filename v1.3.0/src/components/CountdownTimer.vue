<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTimerStore } from '@/stores/timer'

const store = useTimerStore()
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
const arcPathRef = ref<SVGPathElement | null>(null)
const arcLen = ref(46) // fallback，onMounted 后由 getTotalLength 覆盖

// —— 状态判定（必须在使用它的代码之前声明） ——
const state = computed(() => {
  const d = now.value
  const day = d.getDay() || 7 // 周日=7
  if (!store.config.workDays.includes(day)) return 'rest'

  const [sh, sm] = store.config.workStart.split(':').map(Number)
  const [eh, em] = store.config.workEnd.split(':').map(Number)
  const start = new Date(d); start.setHours(sh, sm, 0, 0)
  const end = new Date(d); end.setHours(eh, em, 0, 0)

  if (d < start) return 'before'
  if (d >= end) return 'done'
  return 'working'
})

// ---- 网络图片背景池（Unsplash，与各状态场景匹配） ----
const imagePools: Record<string, string[]> = {
  before: [
    // 晨光/日出 — 寓意崭新开始
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=120&fit=crop&q=70',
  ],
  working: [
    // 午后阳光/办公 — 寓意专注高效
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=120&fit=crop&q=70',
  ],
  done: [
    // 晚霞/夜景 — 寓意收工与满足
    'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=120&fit=crop&q=70',
  ],
  rest: [
    // 自然风光/休憩 — 寓意放松与充电
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400&h=120&fit=crop&q=70',
    'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=120&fit=crop&q=70',
  ],
}

// ---- 图片加载状态 ----
type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'
const bgImageUrl = ref('')
const bgImageStatus = ref<ImageStatus>('idle')
let imageTimeoutId: ReturnType<typeof setTimeout> | null = null
let imageRefreshTimer: ReturnType<typeof setInterval> | null = null

function pickRandomImage(state: string): string {
  const pool = imagePools[state] ?? imagePools.rest
  return pool[Math.floor(Math.random() * pool.length)]
}

function loadBackgroundImage(state: string) {
  // 清理超时
  if (imageTimeoutId) {
    clearTimeout(imageTimeoutId)
    imageTimeoutId = null
  }
  bgImageStatus.value = 'idle'
  bgImageUrl.value = ''

  // 随机选图
  bgImageStatus.value = 'loading'
  const url = pickRandomImage(state)
  bgImageUrl.value = url

  const img = new Image()
  img.onload = () => {
    if (imageTimeoutId) clearTimeout(imageTimeoutId)
    bgImageStatus.value = 'loaded'
  }
  img.onerror = () => {
    if (imageTimeoutId) clearTimeout(imageTimeoutId)
    bgImageStatus.value = 'error'
  }
  img.src = url

  // 5秒超时回退
  imageTimeoutId = setTimeout(() => {
    if (bgImageStatus.value === 'loading') {
      bgImageStatus.value = 'error'
    }
  }, 5000)
}

function startImageRefresh() {
  stopImageRefresh()
  // 每 15 分钟随机换一张同状态图片
  imageRefreshTimer = setInterval(() => {
    if (bgImageStatus.value === 'loaded' || bgImageStatus.value === 'error') {
      loadBackgroundImage(state.value)
    }
  }, 15 * 60 * 1000)
}

function stopImageRefresh() {
  if (imageRefreshTimer) {
    clearInterval(imageRefreshTimer)
    imageRefreshTimer = null
  }
}

onMounted(async () => {
  await store.load()
  now.value = new Date()
  timer = setInterval(() => { now.value = new Date() }, 1000)
  await nextTick()
  if (arcPathRef.value) {
    arcLen.value = arcPathRef.value.getTotalLength()
  }
  // 初始加载背景图片（每次加载随机选图）
  loadBackgroundImage(state.value)
  startImageRefresh()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (imageTimeoutId) clearTimeout(imageTimeoutId)
  stopImageRefresh()
})

// 状态切换时重新加载图片
watch(state, (newState) => {
  loadBackgroundImage(newState)
})

// —— 文字标签 ——
const label = computed(() => {
  const map: Record<string, string> = {
    rest: '休息日',
    before: '距上班',
    working: '距下班',
    done: '已下班',
  }
  return map[state.value]
})

// —— 倒计时毫秒 ——
const countdownMs = computed(() => {
  if (state.value === 'rest' || state.value === 'done') return 0
  const d = now.value
  const [sh, sm] = store.config.workStart.split(':').map(Number)
  const [eh, em] = store.config.workEnd.split(':').map(Number)

  if (state.value === 'before') {
    const start = new Date(d); start.setHours(sh, sm, 0, 0)
    return start.getTime() - d.getTime()
  }
  const end = new Date(d); end.setHours(eh, em, 0, 0)
  return end.getTime() - d.getTime()
})

// —— 时间显示 ——
const display = computed(() => {
  if (state.value === 'done') return '已下班'
  if (state.value === 'rest') return '休息日'
  const ms = countdownMs.value
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

// —— 工时进度 0~1（太阳在弧线上的位置） ——
const progress = computed(() => {
  if (state.value === 'rest' || state.value === 'before') return 0
  if (state.value === 'done') return 1

  const d = now.value
  const [sh, sm] = store.config.workStart.split(':').map(Number)
  const [eh, em] = store.config.workEnd.split(':').map(Number)
  const start = new Date(d); start.setHours(sh, sm, 0, 0)
  const end = new Date(d); end.setHours(eh, em, 0, 0)

  const total = end.getTime() - start.getTime()
  const elapsed = d.getTime() - start.getTime()
  return Math.min(1, Math.max(0, elapsed / total))
})

// —— 太阳在弧线上的坐标（二次贝塞尔：P0(4,24) → P1(16,1) → P2(28,24)） ——
const sunPos = computed(() => {
  const t = progress.value
  const mt = 1 - t
  const x = mt * mt * 4 + 2 * mt * t * 16 + t * t * 28
  const y = mt * mt * 24 + 2 * mt * t * 1 + t * t * 24
  return { x, y }
})

// —— 已走轨迹的 dashoffset ——
const trailOffset = computed(() => arcLen.value * (1 - progress.value))

// —— 配色主题（全冷色调，无暖色） ——
const hasBgImage = computed(() => bgImageStatus.value === 'loaded')

const cardBg = computed(() => {
  if (state.value === 'done') return 'var(--color-success-lighter)'
  if (state.value === 'rest') return 'var(--color-bg-3)'
  return 'var(--color-info-light)'
})

const themeColor = computed(() => {
  // 有图片背景时统一使用白色
  if (hasBgImage.value) return '#fff'
  if (state.value === 'done') return 'var(--color-success)'
  if (state.value === 'rest') return 'var(--color-text-3)'
  return 'var(--color-info)'
})

const textColor = computed(() => {
  // 有图片背景时统一使用白色
  if (hasBgImage.value) return '#fff'
  if (state.value === 'done') return 'var(--color-success-text)'
  if (state.value === 'rest') return 'var(--color-text-2)'
  return 'var(--color-info-text)'
})

const arcPath = 'M 4,24 Q 16,1 28,24'

// —— 五角星顶点（用于已下班状态） ——
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const outer = ((i * 72 - 90) * Math.PI) / 180
    const inner = (((i + 0.5) * 72 - 90) * Math.PI) / 180
    pts.push(`${cx + r * Math.cos(outer)},${cy + r * Math.sin(outer)}`)
    pts.push(`${cx + r * 0.4 * Math.cos(inner)},${cy + r * 0.4 * Math.sin(inner)}`)
  }
  return pts.join(' ')
}
</script>

<template>
  <div
    class="countdown-inline"
    :class="{ 'has-bg-image': bgImageStatus === 'loaded' }"
    :style="{
      background: cardBg,
      backgroundImage: bgImageStatus === 'loaded' ? `url(${bgImageUrl})` : undefined,
    }"
  >
    <!-- 图片已加载时叠加半透明遮罩，保证文字可读性 -->
    <div v-if="bgImageStatus === 'loaded'" class="countdown-image-overlay"></div>

    <!-- 天际线图标 -->
    <div class="countdown-icon" :style="{ background: bgImageStatus === 'loaded' ? 'transparent' : cardBg }">
      <!-- 工作日：弧线 + 太阳/星标 -->
      <svg
        v-if="state !== 'rest'"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        class="skyline-svg"
      >
        <!-- 参考弧线（虚线，始终可见） -->
        <path
          :d="arcPath"
          stroke="var(--color-border)"
          stroke-width="0.8"
          stroke-dasharray="2,3"
          fill="none"
        />
        <!-- 已走过轨迹（实线） -->
        <path
          ref="arcPathRef"
          :d="arcPath"
          :stroke="themeColor"
          stroke-width="1.4"
          fill="none"
          stroke-linecap="round"
          :stroke-dasharray="arcLen + ' ' + arcLen"
          :stroke-dashoffset="trailOffset"
        />
        <!-- 太阳光晕 -->
        <circle
          v-if="state === 'working'"
          :cx="sunPos.x"
          :cy="sunPos.y"
          r="5.5"
          :fill="themeColor"
          opacity="0.12"
        />
        <!-- 太阳 / 星标 -->
        <circle
          v-if="state !== 'done'"
          :cx="sunPos.x"
          :cy="sunPos.y"
          r="2.5"
          :fill="themeColor"
          class="skyline-sun"
        />
        <polygon
          v-else
          :points="starPoints(28, 24, 4)"
          :fill="themeColor"
        />
      </svg>
      <!-- 休息日：弦月 -->
      <svg
        v-else
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        class="skyline-svg"
      >
        <path
          d="M 22,6 A 10,10 0 1,0 22,22 A 8,8 0 1,1 22,6 Z"
          fill="var(--color-text-3)"
          opacity="0.45"
        />
      </svg>
    </div>

    <!-- 文字区域 -->
    <div class="countdown-body">
      <div class="countdown-label" :style="{ color: textColor }">
        {{ label }}
      </div>
      <div class="countdown-time" :style="{ color: textColor }">
        {{ display }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.countdown-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: 12px;
  transition: background 0.6s ease;
  position: relative;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 图片遮罩层：降低图片亮度，保证文字可读性 */
.countdown-image-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 0;
}

/* 图片加载完成后元素置于遮罩之上 */
.has-bg-image .countdown-icon,
.has-bg-image .countdown-body {
  position: relative;
  z-index: 1;
}

/* 图片背景下的文字增强可读性 */
.has-bg-image .countdown-label,
.has-bg-image .countdown-time {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.has-bg-image .skyline-svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.countdown-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.6s ease;
}

.skyline-svg {
  display: block;
}

/* 太阳呼吸感（微弱的 scale 波动） */
.skyline-sun {
  animation: sun-breathe 2s ease-in-out infinite;
  transform-origin: center;
  transform-box: fill-box;
}

@keyframes sun-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

.countdown-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.countdown-label {
  font-size: 11px;
  line-height: 1;
  transition: color 0.6s ease;
}

.countdown-time {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  line-height: 1.3;
  transition: color 0.6s ease;
}
</style>
