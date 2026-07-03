<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { HeatmapView, HeatmapCell } from '@/types'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'

const store = useTaskStore()
const { isDark, isZuru, isTencent } = useTheme()
const view = ref<HeatmapView>('year')

const viewLabels: Record<HeatmapView, string> = { year: '年度', month: '月度', week: '本周' }

/** 内联热力图数据计算——直接访问 store.tasks 确保响应式依赖追踪 */
const data = computed(() => {
  const now = new Date()
  const cells: HeatmapCell[] = []

  // 统计每日任务归属数：优先 startDate，无则回退 createdAt（与任务列表过滤口径一致）
  const countMap = new Map<string, number>()
  for (const t of store.tasks) {
    const d = (t.startDate || t.createdAt.slice(0, 10))
    countMap.set(d, (countMap.get(d) ?? 0) + 1)
  }

  let start: Date
  if (view.value === 'year') {
    start = new Date(now.getFullYear(), 0, 1)
  } else if (view.value === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    const day = now.getDay() || 7
    start = new Date(now)
    start.setDate(now.getDate() - day + 1)
  }

  const end = view.value === 'week'
    ? new Date(start.getTime() + 6 * 86400000)
    : view.value === 'month'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
      : new Date(now.getFullYear(), 11, 31)

  const d = new Date(start)
  while (d <= end) {
    const key = toLocalDate(d)
    const count = countMap.get(key) ?? 0
    const level: HeatmapCell['level'] = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4
    cells.push({ date: key, count, level })
    d.setDate(d.getDate() + 1)
  }

  return cells
})

const colors = computed(() => isDark.value
  ? ['#1a2332', '#1a3a6e', '#2050a8', '#3065cf', '#4d8fff']
  : isZuru.value
    ? ['#d1d5db', '#F9EBEB', '#E59895', '#CB312D', '#AD2A26']
    : isTencent.value
      ? ['#f7faff', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']
      : ['#d1d5db', '#bbf7d0', '#86efac', '#4ade80', '#22c55e']
)

const weekLabels = ['一', '三', '五', '日']

// Build columns (each column = one week, 7 cells top to bottom = Mon to Sun)
// This is the GitHub heatmap layout: weeks as columns, days as rows
const columns = computed(() => {
  const cells = data.value
  if (!cells.length) return []

  const first = new Date(cells[0].date)
  // What day of week is the first date? (0=Mon, 6=Sun)
  const firstDow = (first.getDay() + 6) % 7

  // Create a date-keyed map for quick lookup
  const cellMap = new Map<string, HeatmapCell>()
  for (const c of cells) cellMap.set(c.date, c)

  // Walk from the Monday before (or on) the first date
  const startDate = new Date(first)
  startDate.setDate(startDate.getDate() - firstDow)

  const last = new Date(cells[cells.length - 1].date)
  const lastDow = (last.getDay() + 6) % 7
  const endDate = new Date(last)
  endDate.setDate(endDate.getDate() + (6 - lastDow))

  const cols: (HeatmapCell | null)[][] = []
  let current = new Date(startDate)

  while (current <= endDate) {
    const col: (HeatmapCell | null)[] = []
    for (let d = 0; d < 7; d++) {
      const key = toLocalDate(current)
      col.push(cellMap.get(key) || null)
      current.setDate(current.getDate() + 1)
    }
    cols.push(col)
  }

  return cols
})

// Month labels: positioned above the column where each month starts
const monthMarkers = computed(() => {
  if (view.value !== 'year') return []

  const markers: { label: string; colIndex: number }[] = []
  let lastMonth = -1

  for (let ci = 0; ci < columns.value.length; ci++) {
    // Find the first non-null cell in this column
    const cell = columns.value[ci].find(c => c !== null)
    if (!cell) continue
    const d = new Date(cell.date)
    const m = d.getMonth()
    if (m !== lastMonth) {
      markers.push({ label: (m + 1) + '月', colIndex: ci })
      lastMonth = m
    }
  }

  return markers
})

const totalCount = computed(() => data.value.reduce((s, c) => s + c.count, 0))
const activeDays = computed(() => data.value.filter(c => c.count > 0).length)

function cellColor(cell: HeatmapCell | null): string {
  if (!cell) return 'transparent'
  return colors.value[cell.level]
}

const emptyBorder = computed(() => isTencent.value ? '#EEEFF2' : undefined)

function cellTip(cell: HeatmapCell | null): string {
  if (!cell) return ''
  return `${cell.date}: ${cell.count} 个任务`
}

// ---- Responsive cell size ----
const gridRef = ref<HTMLElement | null>(null)
const cellSize = ref(13)   // default px, will be updated by ResizeObserver
const cellGap = ref(2)

function updateCellSize() {
  const el = gridRef.value
  if (!el) return
  // The grid is inside .heatmap-body, which has padding from the card
  // Available width = grid parent width (after subtracting week-labels width + its margin)
  const bodyEl = el.closest('.heatmap-body') as HTMLElement | null
  if (!bodyEl) return

  const bodyWidth = bodyEl.clientWidth
  const weekLabelW = 24 // .heatmap-week-labels width (~20px) + margin-right (~4px)

  const available = bodyWidth - weekLabelW
  const colCount = columns.value.length
  if (colCount === 0) return

  // Calculate cell size: each column = cellSize + cellGap, but last column has no trailing gap
  // available = colCount * cellSize + (colCount - 1) * cellGap
  // We also need to account for the grid gap (between columns)
  // Simplified: try to fit, max cellSize = 16, min = 6
  const gridGap = cellGap.value
  const totalGapWidth = (colCount - 1) * gridGap
  const rawSize = Math.floor((available - totalGapWidth) / colCount)

  // Clamp
  cellSize.value = Math.max(6, Math.min(16, rawSize))
}

onMounted(() => {
  nextTick(() => {
    updateCellSize()
    if (gridRef.value) {
      const observer = new ResizeObserver(() => updateCellSize())
      observer.observe(gridRef.value.parentElement?.parentElement || gridRef.value)
      ;(gridRef as any)._observer = observer
    }
  })
})

onUnmounted(() => {
  const observer = (gridRef as any)._observer
  if (observer) observer.disconnect()
})

// Re-calculate cell size when view switches (columns count changes)
watch(view, () => nextTick(updateCellSize))
</script>

<template>
  <div class="heatmap-card">
    <div class="heatmap-header">
      <div class="heatmap-title">
        <span class="title-text">{{ viewLabels[view] }}任务热力图</span>
        <span class="title-count">{{ totalCount }} 个任务 · {{ activeDays }} 天活跃</span>
      </div>
      <div class="heatmap-views">
        <button
          v-for="(label, key) in viewLabels"
          :key="key"
          :class="['view-btn', { active: view === key }]"
          @click="view = key as HeatmapView"
        >{{ label }}</button>
      </div>
    </div>

    <!-- Month labels row -->
    <div class="heatmap-months">
      <div class="month-week-spacer"></div>
      <div class="month-track">
        <span
          v-for="(m, i) in monthMarkers"
          :key="i"
          class="month-label"
          :style="{ transform: `translateX(${m.colIndex * (cellSize + cellGap)}px)` }"
        >{{ m.label }}</span>
      </div>
    </div>

    <div class="heatmap-body">
      <!-- Week day labels (7 rows) -->
      <div class="heatmap-week-labels">
        <span v-for="i in 7" :key="i" class="week-label" :style="{ height: `${cellSize}px`, fontSize: cellSize >= 12 ? '9px' : '0px' }">
          {{ [0,2,4,6].includes(i - 1) ? ['一','二','三','四','五','六','日'][i - 1] : '' }}
        </span>
      </div>
      <!-- Grid: columns x 7 rows -->
      <div ref="gridRef" class="heatmap-grid" :style="{ gap: `${cellGap}px` }">
        <div v-for="(col, ci) in columns" :key="ci" class="heatmap-col" :style="{ gap: `${cellGap}px` }">
          <div
            v-for="(cell, ri) in col"
            :key="ri"
            class="heatmap-cell"
            :class="{ 'cell-empty': !cell || cell.level === 0 }"
            :style="{
              backgroundColor: cellColor(cell),
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              borderRadius: cellSize >= 12 ? '2px' : '1px',
              ...(emptyBorder && (!cell || cell.level === 0) ? { outlineColor: emptyBorder } : {})
            }"
            :title="cellTip(cell)"
          />
        </div>
      </div>
    </div>

    <div class="heatmap-legend">
      <span class="legend-label">少</span>
      <span v-for="(c, i) in colors" :key="i" class="legend-cell" :style="{ backgroundColor: c }" />
      <span class="legend-label">多</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap-card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.title-count {
  margin-left: 10px;
  font-size: 12px;
  color: var(--color-text-3);
}

.heatmap-views {
  display: flex;
  gap: 2px;
  background: var(--color-bg-4);
  border-radius: 8px;
  padding: 2px;
}

.view-btn {
  padding: 5px 14px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-text-3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.view-btn.active {
  background: var(--color-surface);
  color: var(--color-text-1);
  box-shadow: 0 1px 2px var(--color-shadow-md);
}

/* Month labels */
.heatmap-months {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding-left: 24px;
}

.month-week-spacer {
  width: 24px;
  flex-shrink: 0;
}

.month-track {
  position: relative;
  height: 16px;
  flex: 1;
}

.month-label {
  position: absolute;
  font-size: 10px;
  color: var(--color-text-3);
  white-space: nowrap;
  top: 0;
  left: 0;
}

.heatmap-body {
  display: flex;
  gap: 0;
  overflow-x: auto;
}

.heatmap-week-labels {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  margin-right: 4px;
  width: 24px;
}

.week-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 10px;
  color: var(--color-text-3);
}

.heatmap-grid {
  display: flex;
  /* gap set via :style binding */
}

.heatmap-col {
  display: flex;
  flex-direction: column;
  /* gap set via :style binding */
}

.heatmap-cell {
  border-radius: 2px;
  transition: transform 0.1s;
}

/* 空格子（level=0 或无数据）加边框，确保网格始终可见 */
.heatmap-cell.cell-empty {
  outline: 1px solid var(--color-border-light);
  outline-offset: -1px;
}

.heatmap-cell:hover {
  transform: scale(1.4);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 12px;
  justify-content: flex-end;
}

.legend-label {
  font-size: 10px;
  color: var(--color-text-3);
}

.legend-cell {
  width: 11px;
  height: 11px;
  border-radius: 2px;
}
</style>