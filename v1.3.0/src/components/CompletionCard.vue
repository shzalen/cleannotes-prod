<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  todayDone: number
}>()

const emit = defineEmits<{
  close: []
}>()

// ---- 时间段判定 ----
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night'

const period = computed<TimePeriod>(() => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
})

const periodMeta = computed(() => {
  switch (period.value) {
    case 'morning':
      return {
        title: '早安，效率达人',
        subtitle: '清晨的第一批任务已被你征服',
        skeletonGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fed7aa 100%)',
        textColor: '#d97706',
        badgeBg: '#fffbeb',
        badgeColor: '#d97706',
      }
    case 'afternoon':
      return {
        title: '午后好状态',
        subtitle: '阳光正好的时光里，你完成了今日目标',
        skeletonGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)',
        textColor: '#059669',
        badgeBg: '#ecfdf5',
        badgeColor: '#059669',
      }
    case 'evening':
      return {
        title: '傍晚收工',
        subtitle: '夕阳下，今日的任务清单已清空',
        skeletonGradient: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 50%, #fda4af 100%)',
        textColor: '#e11d48',
        badgeBg: '#fff1f2',
        badgeColor: '#e11d48',
      }
    case 'night':
      return {
        title: '深夜达成',
        subtitle: '星光不问赶路人，今日任务已全部完成',
        skeletonGradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
        textColor: '#4f46e5',
        badgeBg: '#eef2ff',
        badgeColor: '#4f46e5',
      }
  }
})

// ---- 网络图片池（Unsplash 高质量摄影，专业积极向上） ----
const imagePools: Record<TimePeriod, string[]> = {
  morning: [
    // 晨光穿透山脊 — 寓意崭新开始与突破
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=240&fit=crop&q=80',
    // 静谧湖面倒影 — 寓意专注与清晰
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=240&fit=crop&q=80',
    // 山间薄雾层叠 — 寓意从容与深度
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=240&fit=crop&q=80',
  ],
  afternoon: [
    // 开阔山谷远景 — 寓意视野与前进
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=240&fit=crop&q=80',
    // 林间光束 — 寓意灵感与突破
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=240&fit=crop&q=80',
    // 高山草甸 — 寓意坚持与成长
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=240&fit=crop&q=80',
  ],
  evening: [
    // 金色湖面落日 — 寓意充实与圆满
    'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=600&h=240&fit=crop&q=80',
    // 远山剪影与晚霞 — 寓意收工与满足
    'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=600&h=240&fit=crop&q=80',
    // 落日海洋天际线 — 寓意成就与辽阔
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=240&fit=crop&q=80',
  ],
  night: [
    // 星空下山脊 — 寓意宁静致远
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=240&fit=crop&q=80',
    // 极光夜空 — 寓意独特与卓越
    'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=240&fit=crop&q=80',
    // 银河拱桥 — 寓意宏大与可能
    'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=240&fit=crop&q=80',
  ],
}

// ---- 图片加载状态 ----
type ImageStatus = 'loading' | 'loaded' | 'error'
const imageStatus = ref<ImageStatus>('loading')
const imageUrl = ref('')
let timeoutId: ReturnType<typeof setTimeout> | null = null

function pickRandomImage() {
  const pool = imagePools[period.value]
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]
}

function resetImageState() {
  imageStatus.value = 'loading'
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

function startImageLoad() {
  resetImageState()
  imageUrl.value = pickRandomImage()

  // 5秒超时：如果图片还没加载完，回退到 SVG
  timeoutId = setTimeout(() => {
    if (imageStatus.value === 'loading') {
      imageStatus.value = 'error'
    }
  }, 5000)
}

function onImageLoaded() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  imageStatus.value = 'loaded'
}

function onImageError() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  imageStatus.value = 'error'
}

// 每次弹窗时重新选择图片
watch(() => props.visible, (v) => {
  if (v) startImageLoad()
})

// ---- 激励语库 ----
const quotes: Record<TimePeriod, string[]> = {
  morning: [
    '早起的人，已经赢了一半。',
    '晨光熹微，正是奋进时。',
    '一天之计在于晨，你已旗开得胜。',
    '清晨的专注，是送给自己的礼物。',
    '太阳刚刚升起，你的效率已先行一步。',
  ],
  afternoon: [
    '午后的效率，是对上午最好的延续。',
    '完成目标的感觉，就像夏天的第一口冰汽水。',
    '你的执行力，比午后的阳光更耀眼。',
    '今日事今日毕，你做到了。',
    '每一个完成的任务，都是向理想更近一步。',
  ],
  evening: [
    '日落之前，清单归零。',
    '晚霞为你今天的努力镀金。',
    '今天的高效，是明天从容的底气。',
    '收工时刻，值得为自己鼓掌。',
    '夕阳很美，完成了今日目标的你更美。',
  ],
  night: [
    '星光见证，今日不负。',
    '深夜的完成感，是最高级的满足。',
    '月亮还没睡，你已经赢了今天。',
    '宁静的夜晚，配得上一份清空的清单。',
    '别人在梦里，你在成就里。',
  ],
}

const quote = computed(() => {
  const list = quotes[period.value]
  const idx = Math.floor(Math.random() * list.length)
  return list[idx]
})

function handleClose() {
  emit('close')
}

function handleBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) handleClose()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="completion-overlay" @click="handleBackdrop">
      <Transition name="pop">
        <div v-if="visible" class="completion-card">
          <!-- 关闭按钮 -->
          <button class="close-btn" @click="handleClose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <!-- 顶部场景：网络图片优先，失败回退 SVG -->
          <div class="scene-wrap" :style="{ background: periodMeta.skeletonGradient }">
            <!-- 网络图片 -->
            <img
              v-if="imageStatus !== 'error'"
              :src="imageUrl"
              class="scene-image"
              :class="{ 'is-loaded': imageStatus === 'loaded' }"
              @load="onImageLoaded"
              @error="onImageError"
              alt=""
            />

            <!-- SVG 回退（网络失败时显示） -->
            <div v-if="imageStatus === 'error'" class="svg-fallback">
              <!-- 早晨 -->
              <svg v-if="period === 'morning'" class="scene-svg" viewBox="0 0 280 140" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mornSky" x1="0" y1="0" x2="0" y2="140">
                    <stop offset="0%" stop-color="#fef3c7"/><stop offset="60%" stop-color="#fde68a"/><stop offset="100%" stop-color="#fed7aa"/>
                  </linearGradient>
                  <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/>
                  </linearGradient>
                </defs>
                <rect width="280" height="140" fill="url(#mornSky)"/>
                <circle cx="200" cy="50" r="22" fill="url(#sunGrad)" opacity="0.9"/>
                <circle cx="200" cy="50" r="30" fill="#fbbf24" opacity="0.2">
                  <animate attributeName="r" values="30;34;30" dur="3s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.2;0.1;0.2" dur="3s" repeatCount="indefinite"/>
                </circle>
                <path d="M0 140 L60 75 L120 110 L180 55 L240 95 L280 70 L280 140 Z" fill="#d4a373" opacity="0.3"/>
                <path d="M0 140 L40 90 L90 120 L150 80 L210 105 L280 85 L280 140 Z" fill="#c68b59" opacity="0.4"/>
                <path d="M0 140 L0 110 Q50 100 100 115 T200 105 T280 120 L280 140 Z" fill="#a16207" opacity="0.25"/>
              </svg>
              <!-- 午后 -->
              <svg v-else-if="period === 'afternoon'" class="scene-svg" viewBox="0 0 280 140" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="aftSky" x1="0" y1="0" x2="0" y2="140">
                    <stop offset="0%" stop-color="#ecfdf5"/><stop offset="50%" stop-color="#d1fae5"/><stop offset="100%" stop-color="#a7f3d0"/>
                  </linearGradient>
                  <linearGradient id="sun2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/>
                  </linearGradient>
                </defs>
                <rect width="280" height="140" fill="url(#aftSky)"/>
                <circle cx="220" cy="40" r="18" fill="url(#sun2)" opacity="0.85"/>
                <circle cx="220" cy="40" r="26" fill="#fbbf24" opacity="0.15">
                  <animate attributeName="r" values="26;30;26" dur="4s" repeatCount="indefinite"/>
                </circle>
                <ellipse cx="70" cy="50" rx="25" ry="12" fill="#ffffff" opacity="0.6">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 8,0; 0,0" dur="12s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="85" cy="45" rx="18" ry="10" fill="#ffffff" opacity="0.6">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 8,0; 0,0" dur="12s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="55" cy="48" rx="14" ry="9" fill="#ffffff" opacity="0.6">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 8,0; 0,0" dur="12s" repeatCount="indefinite"/>
                </ellipse>
                <path d="M0 140 Q40 118 80 125 T160 120 T280 128 L280 140 Z" fill="#86efac" opacity="0.25"/>
                <path d="M0 140 Q60 128 120 132 T220 126 T280 134 L280 140 Z" fill="#4ade80" opacity="0.2"/>
              </svg>
              <!-- 傍晚 -->
              <svg v-else-if="period === 'evening'" class="scene-svg" viewBox="0 0 280 140" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eveSky" x1="0" y1="0" x2="0" y2="140">
                    <stop offset="0%" stop-color="#fff1f2"/><stop offset="40%" stop-color="#fecdd3"/><stop offset="80%" stop-color="#fda4af"/><stop offset="100%" stop-color="#f472b6"/>
                  </linearGradient>
                  <linearGradient id="sunSet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f97316"/>
                  </linearGradient>
                </defs>
                <rect width="280" height="140" fill="url(#eveSky)"/>
                <circle cx="140" cy="88" r="28" fill="url(#sunSet)" opacity="0.9">
                  <animate attributeName="cy" values="88;90;88" dur="5s" repeatCount="indefinite"/>
                </circle>
                <rect x="0" y="108" width="280" height="32" fill="#fdba74" opacity="0.15"/>
                <path d="M0 140 L0 115 Q30 105 60 112 T130 108 T200 115 T280 110 L280 140 Z" fill="#be185d" opacity="0.12"/>
                <path d="M0 140 L0 122 Q40 115 80 120 T170 116 T280 124 L280 140 Z" fill="#9d174d" opacity="0.15"/>
              </svg>
              <!-- 深夜 -->
              <svg v-else class="scene-svg" viewBox="0 0 280 140" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="140">
                    <stop offset="0%" stop-color="#1e1b4b"/><stop offset="50%" stop-color="#312e81"/><stop offset="100%" stop-color="#4338ca"/>
                  </linearGradient>
                </defs>
                <rect width="280" height="140" fill="url(#nightSky)"/>
                <circle cx="230" cy="38" r="16" fill="#fef3c7" opacity="0.9"/>
                <circle cx="224" cy="34" r="14" fill="#4338ca" opacity="0.4"/>
                <g fill="#ffffff">
                  <circle cx="40" cy="25" r="1.5" opacity="0.8"><animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/></circle>
                  <circle cx="80" cy="45" r="1" opacity="0.6"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="3s" repeatCount="indefinite"/></circle>
                  <circle cx="120" cy="20" r="1.2" opacity="0.7"><animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.5s" repeatCount="indefinite"/></circle>
                  <circle cx="160" cy="55" r="1" opacity="0.5"><animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite"/></circle>
                  <circle cx="195" cy="28" r="1.3" opacity="0.75"><animate attributeName="opacity" values="0.75;0.2;0.75" dur="2.2s" repeatCount="indefinite"/></circle>
                </g>
                <line x1="100" y1="15" x2="85" y2="25" stroke="#ffffff" stroke-width="0.8" opacity="0">
                  <animate attributeName="opacity" values="0;0.7;0" dur="4s" begin="1s" repeatCount="indefinite"/>
                  <animate attributeName="x1" values="100;70" dur="4s" begin="1s" repeatCount="indefinite"/>
                  <animate attributeName="y1" values="15;35" dur="4s" begin="1s" repeatCount="indefinite"/>
                  <animate attributeName="x2" values="85;55" dur="4s" begin="1s" repeatCount="indefinite"/>
                  <animate attributeName="y2" values="25;45" dur="4s" begin="1s" repeatCount="indefinite"/>
                </line>
                <path d="M0 140 L0 120 Q50 108 100 118 T200 112 T280 125 L280 140 Z" fill="#1e1b4b" opacity="0.5"/>
                <path d="M0 140 L0 128 Q60 118 120 126 T240 120 T280 132 L280 140 Z" fill="#312e81" opacity="0.3"/>
              </svg>
            </div>
          </div>

          <!-- 文字内容 -->
          <div class="card-body">
            <!-- 徽章 -->
            <div class="completion-badge" :style="{ background: periodMeta.badgeBg, color: periodMeta.badgeColor }">
              <div class="badge-dot" :style="{ background: periodMeta.badgeColor }"></div>
              <span>全部完成</span>
            </div>

            <!-- 标题 -->
            <h2 class="card-title" :style="{ color: periodMeta.textColor }">
              {{ periodMeta.title }}
            </h2>
            <p class="card-subtitle">{{ periodMeta.subtitle }}</p>

            <!-- 激励语 -->
            <div class="quote-wrap">
              <span class="quote-mark">"</span>
              <p class="quote-text">{{ quote }}</p>
              <span class="quote-mark end">"</span>
            </div>

            <!-- 双指标 -->
            <div class="stats-row">
              <div class="stat-item">
                <span class="stat-value" :style="{ color: periodMeta.textColor }">{{ todayDone }}</span>
                <span class="stat-label">任务</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value" :style="{ color: periodMeta.textColor }">100%</span>
                <span class="stat-label">完成率</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* ---- 遮罩层 ---- */
.completion-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-md);
  backdrop-filter: blur(4px);
  padding: 20px;
}

/* ---- 卡片容器 ---- */
.completion-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  background: var(--color-surface);
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 20px 60px var(--color-shadow-md),
    0 0 0 1px var(--color-border-light);
  animation: card-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ---- 关闭按钮 ---- */
.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: rotate(90deg);
}

/* ---- 场景区域 ---- */
.scene-wrap {
  width: 100%;
  height: 160px;
  overflow: hidden;
  position: relative;
}

.scene-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.scene-image.is-loaded {
  opacity: 1;
}

.svg-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scene-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* ---- 卡片内容 ---- */
.card-body {
  padding: 20px 28px 28px;
  text-align: center;
}

.completion-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  margin-bottom: 14px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
  line-height: 1.3;
}

.card-subtitle {
  font-size: 13px;
  color: var(--color-text-3);
  margin: 0 0 18px;
  line-height: 1.5;
}

/* ---- 引言 ---- */
.quote-wrap {
  position: relative;
  padding: 14px 18px;
  background: var(--color-bg-3);
  border-radius: 14px;
  margin-bottom: 20px;
}

.quote-mark {
  position: absolute;
  font-size: 28px;
  font-family: Georgia, serif;
  line-height: 1;
  color: var(--color-text-4);
  opacity: 0.4;
}

.quote-mark:not(.end) {
  top: 4px;
  left: 10px;
}

.quote-mark.end {
  bottom: -2px;
  right: 10px;
}

.quote-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-2);
  line-height: 1.6;
  position: relative;
  z-index: 1;
  margin: 0;
}

/* ---- 统计 ---- */
.stats-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 70px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--color-border);
  margin: 0 20px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-3);
  font-weight: 500;
}

/* ---- Transition ---- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

/* ---- 深色模式优化 ---- */
[data-theme="dark"] .completion-card {
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px var(--color-border);
}

[data-theme="dark"] .close-btn {
  background: rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .close-btn:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>
