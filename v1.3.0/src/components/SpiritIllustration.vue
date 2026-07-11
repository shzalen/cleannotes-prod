<script setup lang="ts">
import { computed } from 'vue'
import type { DailyState } from '@/types'
import { useTheme } from '@/composables/useTheme'

// DEF-A5: Unique prefix for SVG gradient IDs to avoid conflicts
// when multiple SpiritIllustration instances exist on the same page
let uidCounter = 0
const uid = `si${uidCounter++}`

const props = defineProps<{
  level: number
  dailyState: DailyState
  size?: 'sm' | 'md' | 'lg'
}>()

const { isDark } = useTheme()

const sizeScale = computed(() => {
  switch (props.size ?? 'md') {
    case 'sm': return 0.5
    case 'md': return 0.75
    case 'lg': return 1.0
  }
})

// ---- 火焰高度 = 等级映射 ----
// Lv.1: flame 14px, Lv.50+: flame 30px, linear interpolation
const flameHeight = computed(() => {
  const min = 14
  const max = 30
  const progress = Math.min((props.level - 1) / 49, 1)
  return min + progress * (max - min)
})

const flameWidth = computed(() => flameHeight.value * 0.55)

// ---- 光晕半径 = 活力映射 ----
// vitality: 30, recovery: 22, withered: 14
const haloRadius = computed(() => {
  switch (props.dailyState) {
    case 'vitality': return 30
    case 'recovery': return 22
    case 'withered': return 14
  }
})

// ---- 蜡烛体高度 = 累计经验映射 ----
// Lv.1=28px, Lv.50=52px
const candleHeight = computed(() => {
  const min = 28
  const max = 52
  const progress = Math.min((props.level - 1) / 49, 1)
  return min + progress * (max - min)
})

// ---- 日状态 opacity / style ----
const stateOpacity = computed(() => {
  switch (props.dailyState) {
    case 'vitality': return 1.0
    case 'recovery': return 0.85
    case 'withered': return 0.6
  }
})

const flameOpacity = computed(() => {
  switch (props.dailyState) {
    case 'vitality': return 1.0
    case 'recovery': return 0.88
    case 'withered': return 0.5
  }
})

// ---- 颜色映射 (light / dark) ----
// 渐变 stop 需要多组颜色
const colors = computed(() => {
  if (isDark.value) {
    return {
      // 暗黑模式：暖色更亮以营造光感
      candleBodyTop: '#E8DCC8',
      candleBodyBottom: '#D4C4A0',
      candleStroke: '#9C8B70',
      candleInner: '#F5ECD8',
      // 火焰渐变
      flameOuterStart: '#FFD080',
      flameOuterEnd: '#F0A830',
      flameMiddleStart: '#FFB850',
      flameMiddleEnd: '#E88A10',
      flameInnerStart: '#FFFCE8',
      flameInnerEnd: '#FFF0D0',
      // 光晕
      haloCenter: '#FFE0A0',
      haloEdge: '#FFE0A0',
      // 蜡芯
      wickColor: '#4A4038',
      // 底座
      baseFill: '#55524E',
      baseStroke: '#7A756E',
      // 融顶弧
      meltFill: '#F0E0C8',
      meltStroke: '#9C8B70',
      // 蜡滴
      dripFill: '#E8DCC8',
    }
  }
  return {
    // 亮色模式
    candleBodyTop: '#FAF0DC',
    candleBodyBottom: '#F0E0C0',
    candleStroke: '#C49450',
    candleInner: '#FFF8E8',
    flameOuterStart: '#FFD080',
    flameOuterEnd: '#F0A830',
    flameMiddleStart: '#FFB850',
    flameMiddleEnd: '#E88A10',
    flameInnerStart: '#FFFCE8',
    flameInnerEnd: '#FFF0D0',
    haloCenter: '#FFE0A0',
    haloEdge: '#FFE0A0',
    wickColor: '#6B5840',
    baseFill: '#D8D0C0',
    baseStroke: '#B8A898',
    meltFill: '#FFF8E8',
    meltStroke: '#C49450',
    dripFill: '#FAF0DC',
  }
})

// ---- SVG viewBox ----
const candleBodyWidth = 20
const meltArcHeight = 3
const wickLength = 5
const baseHeight = 8
const baseExtraWidth = 6 // 底座比蜡烛体每边多出 3px

// 总高度：融化弧 + 蜡烛体 + 底座 + 蜡芯 + 火焰 + 顶部留白
const svgHeight = computed(() => meltArcHeight + candleHeight.value + baseHeight + wickLength + flameHeight.value + 10)
const svgWidth = computed(() => Math.max(haloRadius.value * 2 + 20, 80))

// 关键 Y 坐标
const candleBodyTop = computed(() => 2 + flameHeight.value + wickLength) // 融化弧顶部 y
const candleBodyBottom = computed(() => candleBodyTop.value + meltArcHeight + candleHeight.value)
const baseY = computed(() => candleBodyBottom.value)
const wickTop = computed(() => candleBodyTop.value - wickLength) // 蜡芯顶部 y
const flameBottom = computed(() => wickTop.value) // 火焰底部与蜡芯顶部对齐
const flameCenterY = computed(() => flameBottom.value + flameHeight.value * 0.55) // 火焰椭圆中心
const centerX = computed(() => svgWidth.value / 2)
</script>

<template>
  <svg
    :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
    :width="svgWidth * sizeScale"
    :height="svgHeight * sizeScale"
    role="img"
    class="spirit-candle"
  >
    <title>烛 · Lv.{{ level }}</title>

    <!-- ===== 渐变定义 ===== -->
    <defs>
      <!-- 光晕径向渐变 -->
      <radialGradient :id="`${uid}-haloGrad`" :cx="centerX" :cy="flameCenterY" :r="haloRadius" gradientUnits="userSpaceOnUse">
        <stop offset="0%" :stop-color="colors.haloCenter" :stop-opacity="dailyState === 'withered' ? 0.12 : 0.18" />
        <stop offset="70%" :stop-color="colors.haloEdge" :stop-opacity="dailyState === 'withered' ? 0.04 : 0.08" />
        <stop offset="100%" :stop-color="colors.haloEdge" :stop-opacity="0" />
      </radialGradient>

      <!-- 火焰外层渐变 -->
      <linearGradient :id="`${uid}-flameOuterGrad`" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" :stop-color="colors.flameOuterEnd" />
        <stop offset="100%" :stop-color="colors.flameOuterStart" />
      </linearGradient>

      <!-- 火焰中层渐变 -->
      <linearGradient :id="`${uid}-flameMiddleGrad`" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" :stop-color="colors.flameMiddleEnd" />
        <stop offset="100%" :stop-color="colors.flameMiddleStart" />
      </linearGradient>

      <!-- 火焰内层渐变 -->
      <linearGradient :id="`${uid}-flameInnerGrad`" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" :stop-color="colors.flameInnerEnd" />
        <stop offset="100%" :stop-color="colors.flameInnerStart" />
      </linearGradient>

      <!-- 蜡烛体渐变 -->
      <linearGradient :id="`${uid}-candleBodyGrad`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="colors.candleBodyTop" />
        <stop offset="100%" :stop-color="colors.candleBodyBottom" />
      </linearGradient>

      <!-- 融化弧渐变 -->
      <linearGradient :id="`${uid}-meltGrad`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="colors.meltFill" />
        <stop offset="100%" :stop-color="colors.candleBodyTop" />
      </linearGradient>
    </defs>

    <!-- ===== 光晕 ===== -->
    <circle
      :cx="centerX"
      :cy="flameCenterY"
      :r="haloRadius"
      :fill="`url(#${uid}-haloGrad)`"
      class="spirit-halo"
    />

    <!-- ===== 底座 ===== -->
    <rect
      :x="centerX - candleBodyWidth / 2 - baseExtraWidth / 2"
      :y="baseY"
      :width="candleBodyWidth + baseExtraWidth"
      :height="baseHeight"
      rx="3"
      :fill="colors.baseFill"
      :stroke="colors.baseStroke"
      stroke-width="0.6"
      :opacity="stateOpacity"
    />

    <!-- ===== 蜡烛体 ===== -->
    <rect
      :x="centerX - candleBodyWidth / 2"
      :y="candleBodyTop + meltArcHeight"
      :width="candleBodyWidth"
      :height="candleHeight"
      rx="3"
      :fill="`url(#${uid}-candleBodyGrad)`"
      :stroke="colors.candleStroke"
      stroke-width="0.8"
      :opacity="stateOpacity"
    />

    <!-- 蜡烛体内部高光条 -->
    <rect
      :x="centerX - candleBodyWidth / 2 + 3"
      :y="candleBodyTop + meltArcHeight + 2"
      :width="4"
      :height="candleHeight - 4"
      rx="2"
      :fill="colors.candleInner"
      :opacity="stateOpacity * 0.35"
    />

    <!-- ===== 融化弧（蜡烛顶部） ===== -->
    <path
      :d="`M${centerX - candleBodyWidth / 2},${candleBodyTop + meltArcHeight} Q${centerX},${candleBodyTop} ${centerX + candleBodyWidth / 2},${candleBodyTop + meltArcHeight}`"
      :fill="`url(#${uid}-meltGrad)`"
      :stroke="colors.meltStroke"
      stroke-width="0.6"
      :opacity="stateOpacity"
    />

    <!-- ===== 蜡滴（右侧） ===== -->
    <path
      :d="`M${centerX + candleBodyWidth / 2 - 1},${candleBodyTop + meltArcHeight + candleHeight * 0.35} Q${centerX + candleBodyWidth / 2 + 4},${candleBodyTop + meltArcHeight + candleHeight * 0.42} ${centerX + candleBodyWidth / 2},${candleBodyTop + meltArcHeight + candleHeight * 0.55}`"
      :fill="colors.dripFill"
      :stroke="colors.candleStroke"
      stroke-width="0.4"
      :opacity="stateOpacity * 0.7"
    />

    <!-- ===== 蜡芯 ===== -->
    <line
      :x1="centerX"
      :y1="wickTop"
      :x2="centerX"
      :y2="candleBodyTop"
      :stroke="colors.wickColor"
      stroke-width="1.5"
      stroke-linecap="round"
      :opacity="stateOpacity * 0.9"
    />

    <!-- ===== 火焰外层 ===== -->
    <ellipse
      :cx="centerX"
      :cy="flameCenterY"
      :rx="flameWidth"
      :ry="flameHeight"
      :fill="`url(#${uid}-flameOuterGrad)`"
      :opacity="flameOpacity"
      class="spirit-flame-outer"
    />

    <!-- ===== 火焰中层 ===== -->
    <ellipse
      :cx="centerX"
      :cy="flameCenterY + flameHeight * 0.08"
      :rx="flameWidth * 0.55"
      :ry="flameHeight * 0.65"
      :fill="`url(#${uid}-flameMiddleGrad)`"
      :opacity="flameOpacity * 0.9"
      class="spirit-flame-middle"
    />

    <!-- ===== 火焰内层（亮心） ===== -->
    <ellipse
      :cx="centerX"
      :cy="flameCenterY + flameHeight * 0.2"
      :rx="flameWidth * 0.25"
      :ry="flameHeight * 0.28"
      :fill="`url(#${uid}-flameInnerGrad)`"
      :opacity="flameOpacity * 0.88"
      class="spirit-flame-inner"
    />
  </svg>
</template>

<style scoped>
.spirit-candle {
  transition: all 0.6s ease;
}

/* 光晕脉动 */
.spirit-halo {
  animation: halo-pulse 3s ease-in-out infinite;
  transform-origin: center;
}

/* 火焰摇曳 */
.spirit-flame-outer {
  animation: flame-flicker-outer 2s ease-in-out infinite;
  transform-origin: bottom center;
}

.spirit-flame-middle {
  animation: flame-flicker-middle 1.8s ease-in-out infinite;
  transform-origin: bottom center;
}

.spirit-flame-inner {
  animation: flame-flicker-inner 1.4s ease-in-out infinite;
  transform-origin: bottom center;
}

@keyframes halo-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

@keyframes flame-flicker-outer {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  25% { transform: scaleX(1.04) scaleY(0.98) translateY(0.5px); }
  50% { transform: scaleX(0.97) scaleY(1.02) translateY(-0.5px); }
  75% { transform: scaleX(1.02) scaleY(0.99) translateY(0.3px); }
}

@keyframes flame-flicker-middle {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  30% { transform: scaleX(1.06) scaleY(0.97) translateY(0.8px); }
  60% { transform: scaleX(0.95) scaleY(1.03) translateY(-0.4px); }
}

@keyframes flame-flicker-inner {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  20% { transform: scaleX(1.08) scaleY(0.96) translateY(0.6px); }
  50% { transform: scaleX(0.96) scaleY(1.02) translateY(-0.3px); }
  80% { transform: scaleX(1.04) scaleY(0.98) translateY(0.4px); }
}
</style>