<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { HeatmapCell } from '@/types'

const store = useTaskStore()
const { isDark, isZuru, isTencent } = useTheme()

/** 暗黑/ZURU/腾讯蓝 模式响应颜色 */
const chartLine = computed(() => isDark.value ? '#4d8fff' : isZuru.value ? '#d04642' : isTencent.value ? '#1a63dd' : '#38cb6e')
const chartAreaOpaque = computed(() => isDark.value ? 'rgba(77,143,255,0.18)' : isZuru.value ? 'rgba(208,70,66,0.18)' : isTencent.value ? 'rgba(26,99,221,0.18)' : 'rgba(56,203,110,0.18)')
const chartAreaFaint = computed(() => isDark.value ? 'rgba(77,143,255,0.02)' : isZuru.value ? 'rgba(208,70,66,0.04)' : isTencent.value ? 'rgba(26,99,221,0.02)' : 'rgba(56,203,110,0.02)')
const gridColor = computed(() => isDark.value ? 'var(--color-border)' : isZuru.value ? '#DFE2E6' : isTencent.value ? '#f3f4f6' : '#f3f4f6')
const axisColor = computed(() => isDark.value ? 'var(--color-text-3)' : isZuru.value ? '#999999' : isTencent.value ? '#9ca3af' : '#9ca3af')
const dotFill = computed(() => isDark.value ? 'var(--color-surface)' : isTencent.value ? '#ffffff' : '#ffffff')
const dotStroke = computed(() => isDark.value ? '#4d8fff' : isZuru.value ? '#d04642' : isTencent.value ? '#1a63dd' : '#38cb6e')
const tooltipBg = computed(() => isDark.value ? 'var(--color-bg-2)' : isZuru.value ? '#1A1A1A' : '#1f2937')
const tooltipColor = computed(() => isDark.value ? 'var(--color-text-1)' : '#fff')
const tooltipSub = computed(() => isDark.value ? 'var(--color-text-3)' : isZuru.value ? '#999999' : isTencent.value ? '#94a3b8' : '#94a3b8')

const gradientStops = computed(() => [
  { offset: '0%', color: chartAreaOpaque.value },
  { offset: '100%', color: chartAreaFaint.value }
])

/** 最近 30 天每日任务量（创建+完成），与热力图统计口径完全一致 */
const chartData = computed(() => {
  const now = new Date()
  const today = toLocalDate(now)

  // 计算 30 天前的日期
  const d = new Date(now)
  d.setDate(d.getDate() - 29)   // 共 30 天（含今天）
  const startDate = toLocalDate(d)

  // 统计每日创建 + 完成数（与 getHeatmapData 口径一致）
  const countMap = new Map<string, number>()
  for (const t of store.tasks) {
    const cd = t.createdAt.slice(0, 10)
    if (cd >= startDate && cd <= today) {
      countMap.set(cd, (countMap.get(cd) ?? 0) + 1)
    }
    if (t.completedAt) {
      const dd = t.completedAt.slice(0, 10)
      if (dd >= startDate && dd <= today) {
        countMap.set(dd, (countMap.get(dd) ?? 0) + 1)
      }
    }
  }

  // 生成连续 30 天的数组
  const cells: HeatmapCell[] = []
  const cursor = new Date(startDate)
  while (toLocalDate(cursor) <= today) {
    const key = toLocalDate(cursor)
    const count = countMap.get(key) ?? 0
    const level: HeatmapCell['level'] =
      count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4
    cells.push({ date: key, count, level })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
})

const maxCount = computed(() => {
  const max = Math.max(...chartData.value.map(c => c.count), 1)
  return Math.ceil(max * 1.15)
})

const padding = { top: 16, right: 8, bottom: 28, left: 28 }
const width = 640
const height = 180
const chartW = width - padding.left - padding.right
const chartH = height - padding.top - padding.bottom

function x(index: number) {
  return padding.left + (index / (chartData.value.length - 1 || 1)) * chartW
}

function y(count: number) {
  return padding.top + chartH - (count / maxCount.value) * chartH
}

/** Catmull-Rom spline to cubic bezier */
function smoothLine(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return d
}

const linePath = computed(() => {
  const pts = chartData.value.map((c, i) => ({ x: x(i), y: y(c.count) }))
  return smoothLine(pts)
})

const areaPath = computed(() => {
  const pts = chartData.value.map((c, i) => ({ x: x(i), y: y(c.count) }))
  if (pts.length === 0) return ''
  const line = smoothLine(pts)
  const last = pts[pts.length - 1]
  const bottomY = padding.top + chartH
  return `${line} L ${last.x} ${bottomY} L ${padding.left} ${bottomY} Z`
})

const yTicks = computed(() => {
  const ticks: number[] = []
  const step = maxCount.value <= 5 ? 1 : Math.ceil(maxCount.value / 4)
  for (let v = 0; v <= maxCount.value; v += step) {
    ticks.push(v)
  }
  if (ticks[ticks.length - 1] !== maxCount.value) {
    ticks.push(maxCount.value)
  }
  return ticks
})

function formatLabel(date: string): string {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatFullDate(date: string): string {
  const d = new Date(date)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const xLabels = computed(() => {
  const total = chartData.value.length
  if (total <= 1) return []
  const count = Math.min(total, 6)
  const step = Math.max(1, Math.floor((total - 1) / (count - 1)))
  const labels: { x: number; text: string }[] = []
  for (let i = 0; i < total; i += step) {
    labels.push({ x: x(i), text: formatLabel(chartData.value[i].date) })
  }
  // 确保最后一个标签
  if ((total - 1) % step !== 0) {
    const last = labels[labels.length - 1]
    if (!last || last.x < x(total - 1) - 20) {
      labels.push({ x: x(total - 1), text: formatLabel(chartData.value[total - 1].date) })
    }
  }
  return labels
})
</script>

<template>
  <div class="trend-card">
    <div class="trend-header">
      <span class="trend-title">任务趋势</span>
      <span class="trend-sub">近 30 天每日任务量</span>
    </div>

    <svg class="trend-chart" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop v-for="(s, i) in gradientStops" :key="i" :offset="s.offset" :stop-color="s.color" />
        </linearGradient>
      </defs>

      <!-- Grid lines (horizontal) -->
      <line
        v-for="tick in yTicks"
        :key="tick"
        :x1="padding.left"
        :y1="y(tick)"
        :x2="width - padding.right"
        :y2="y(tick)"
        :stroke="gridColor"
        stroke-width="0.8"
      />

      <!-- Y axis labels -->
      <text
        v-for="tick in yTicks"
        :key="`y-${tick}`"
        :x="padding.left - 6"
        :y="y(tick)"
        text-anchor="end"
        dominant-baseline="middle"
        font-size="6"
        :fill="axisColor"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
      >{{ tick }}</text>

      <!-- Area fill -->
      <path :d="areaPath" fill="url(#areaGrad)" />

      <!-- Line -->
      <path :d="linePath" fill="none" :stroke="chartLine" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data points -->
      <circle
        v-for="(c, i) in chartData"
        :key="i"
        :cx="x(i)"
        :cy="y(c.count)"
        r="1.9"
        :fill="dotFill"
        :stroke="dotStroke"
        stroke-width="1"
      />

      <!-- X axis labels -->
      <text
        v-for="(lbl, i) in xLabels"
        :key="`x-${i}`"
        :x="lbl.x"
        :y="height - 6"
        text-anchor="middle"
        font-size="6"
        :fill="axisColor"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
      >{{ lbl.text }}</text>
    </svg>

    <!-- Tooltip area (simple hover per point) -->
    <div class="trend-hover">
      <div
        v-for="(c, i) in chartData"
        :key="`h-${i}`"
        class="hover-col"
        :style="{ left: `${(i / (chartData.length - 1 || 1)) * 100}%` }"
      >
        <div class="hover-tip">
          <div class="tip-date">{{ formatFullDate(c.date) }}</div>
          <div class="tip-count">{{ c.count }} 个任务</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
  position: relative;
}

.trend-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}

.trend-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.trend-sub {
  font-size: 12px;
  color: var(--color-text-3);
}

.trend-chart {
  width: 100%;
  height: auto;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* Hover columns for tooltip */
.trend-hover {
  position: absolute;
  top: 50px;
  left: 24px;
  right: 24px;
  bottom: 36px;
  display: flex;
  pointer-events: none;
}

.hover-col {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: auto;
  cursor: default;
}

.hover-col::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 0;
  bottom: 0;
  width: 24px;
  pointer-events: auto;
}

.hover-tip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  background: var(--color-bg-2);
  color: var(--color-text-1);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 10px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
  z-index: 10;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.hover-tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--color-bg-2);
}

.hover-col:hover .hover-tip {
  opacity: 1;
}

.tip-date {
  color: var(--color-text-3);
}

.tip-count {
  font-weight: 600;
}
</style>
