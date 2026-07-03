<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { WeeklyReport, Task, TodoItem } from '@/types'
import { useTaskStore, formatDuration } from '@/stores/task'
import { useTodoStore } from '@/stores/todo'
import { getWeekNumber, getWeekLabel } from '@/stores/weeklyReport'

const props = defineProps<{
  report: WeeklyReport
}>()

const emit = defineEmits<{
  close: []
}>()

const taskStore = useTaskStore()
const todoStore = useTodoStore()
const posterRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

// ---- Data ----
onMounted(() => {
  if (!taskStore.loaded) taskStore.load()
  if (!todoStore.loaded) todoStore.load()
  document.addEventListener('keydown', handleEsc)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc)
})

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && !exporting.value) emit('close')
}

// Week info
const weekNum = computed(() => getWeekNumber(props.report.weekStart))
const weekLabel = computed(() => getWeekLabel(props.report.weekStart))
const dateRange = computed(() => {
  const [sy, sm, sd] = props.report.weekStart.split('-').map(Number)
  const [ey, em, ed] = props.report.weekEnd.split('-').map(Number)
  return `${sm}.${sd} — ${em}.${ed}`
})
const year = computed(() => props.report.weekStart.slice(0, 4))

// Completion ring
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const rate = computed(() => props.report.summary.completionRate)
const ringOffset = computed(() => CIRCUMFERENCE * (1 - rate.value / 100))
const ringColorClass = computed(() => {
  if (rate.value >= 80) return 'high'
  if (rate.value >= 50) return 'mid'
  return 'low'
})

// Tasks for this week
const completedTasks = computed<Task[]>(() => {
  const { weekStart, weekEnd } = props.report
  return taskStore.tasks
    .filter(t =>
      t.status === 'done' && t.completedAt &&
      t.completedAt >= weekStart + 'T00:00:00' &&
      t.completedAt <= weekEnd + 'T23:59:59'
    )
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
})

const pendingTasks = computed<Task[]>(() => {
  return taskStore.tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      return 0
    })
    .slice(0, 8) // poster only shows top 8
})

const todosThisWeek = computed<TodoItem[]>(() => {
  const { weekStart, weekEnd } = props.report
  return todoStore.todos.filter(t =>
    t.createdAt >= weekStart + 'T00:00:00' &&
    t.createdAt <= weekEnd + 'T23:59:59'
  )
})

// Priority badge
const priorityMap: Record<string, { label: string; cls: string }> = {
  high: { label: '高', cls: 'p-high' },
  medium: { label: '中', cls: 'p-mid' },
  low: { label: '低', cls: 'p-low' },
}

function taskCompletedDate(task: Task): string {
  if (!task.completedAt) return ''
  return formatDateTime(task.completedAt)
}

function taskStartedAt(task: Task): string {
  if (!task.inProgressAt) return '—'
  return formatDateTime(task.inProgressAt)
}

function taskDuration(task: Task): string {
  return formatDuration(task) || '—'
}

/** 格式化 ISO 时间戳为本地 YYYY-MM-DD HH:MM */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${mins}`
}

function taskDueDate(task: Task): string {
  if (!task.dueDate) return '—'
  return task.dueDate.slice(5, 10).replace('-', '/')
}

// Properties that commonly use CSS variables / color-mix()
const RESOLVE_PROPS = [
  'backgroundColor', 'color',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'backgroundImage', 'boxShadow', 'opacity', 'outlineColor',
  'fill', 'stroke', 'strokeWidth',
] as const

// ---- Export ----
async function exportAsImage() {
  if (!posterRef.value || exporting.value) return
  exporting.value = true
  try {
    const html2canvas = (await import('html2canvas-pro')).default
    const poster = posterRef.value

    // Pre-collect computed styles from the LIVE element tree
    // (getComputedStyle resolves var() and color-mix() → actual RGB values)
    const allEls = [poster, ...Array.from(poster.querySelectorAll('*'))]
    const computedStyles = allEls.map(el => {
      const cs = getComputedStyle(el)
      const snap: Record<string, string> = {}
      for (const p of RESOLVE_PROPS) {
        snap[p] = cs.getPropertyValue(p as string) || (cs as unknown as Record<string, string>)[p]
      }
      // Also grab pseudo-element backgrounds
      const before = getComputedStyle(el, '::before')
      const after = getComputedStyle(el, '::after')
      return {
        snap,
        beforeBg: before.backgroundColor,
        beforeImg: before.backgroundImage,
        afterBg: after.backgroundColor,
        afterImg: after.backgroundImage,
      }
    })

    const canvas = await html2canvas(poster, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: poster.scrollWidth + 60,
      windowHeight: poster.scrollHeight + 60,
      onclone: (clonedDoc: Document, clonedPoster: HTMLElement) => {
        // 1) Inject resolved CSS variables at :root so any remaining var() refs work
        const rootStyle = getComputedStyle(document.documentElement)
        const vars: string[] = []
        for (let i = 0; i < rootStyle.length; i++) {
          const prop = rootStyle[i]
          if (prop.startsWith('--')) {
            vars.push(`${prop}: ${rootStyle.getPropertyValue(prop).trim()};`)
          }
        }
        const styleTag = clonedDoc.createElement('style')
        styleTag.textContent = `:root { ${vars.join(' ')} }`
        clonedDoc.head.appendChild(styleTag)

        // 2) Inline resolved computed values on every element
        const clonedEls = [clonedPoster, ...Array.from(clonedPoster.querySelectorAll('*'))]
        clonedEls.forEach((clone, i) => {
          const data = computedStyles[i]
          if (!data) return
          const s = data.snap
          clone.style.backgroundColor = s.backgroundColor
          clone.style.color = s.color
          clone.style.borderTopColor = s.borderTopColor
          clone.style.borderRightColor = s.borderRightColor
          clone.style.borderBottomColor = s.borderBottomColor
          clone.style.borderLeftColor = s.borderLeftColor
          clone.style.borderTopWidth = s.borderTopWidth
          clone.style.borderRightWidth = s.borderRightWidth
          clone.style.borderBottomWidth = s.borderBottomWidth
          clone.style.borderLeftWidth = s.borderLeftWidth
          clone.style.borderTopStyle = s.borderTopStyle
          clone.style.borderRightStyle = s.borderRightStyle
          clone.style.borderBottomStyle = s.borderBottomStyle
          clone.style.borderLeftStyle = s.borderLeftStyle
          clone.style.backgroundImage = s.backgroundImage
          clone.style.boxShadow = s.boxShadow
          clone.style.opacity = s.opacity
          clone.style.outlineColor = s.outlineColor

          // SVG fill / stroke — set as attribute for reliability
          if (clone instanceof SVGElement || clone.tagName === 'circle' || clone.tagName === 'path' || clone.tagName === 'rect' || clone.tagName === 'line' || clone.tagName === 'polyline' || clone.tagName === 'polygon') {
            if (s.fill && s.fill !== 'rgb(0, 0, 0)') {
              clone.setAttribute('fill', s.fill)
            }
            if (s.stroke && s.stroke !== 'rgb(0, 0, 0)') {
              clone.setAttribute('stroke', s.stroke)
            }
          }
        })
      },
    })

    const link = document.createElement('a')
    link.download = `清记周报_W${weekNum.value}_${props.report.weekStart}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (err) {
    console.error('Export failed:', err)
    alert('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

const s = props.report.summary
</script>

<template>
  <Teleport to="body">
    <div class="poster-overlay" @click.self="!exporting && emit('close')">
      <!-- Toolbar -->
      <div class="poster-toolbar">
        <button class="tool-btn" @click="emit('close')" :disabled="exporting">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>关闭</span>
        </button>
        <button class="tool-btn export" @click="exportAsImage" :disabled="exporting">
          <svg v-if="!exporting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>{{ exporting ? '导出中...' : '导出 PNG' }}</span>
        </button>
      </div>

      <!-- Poster Canvas -->
      <div class="poster-scroll">
        <div ref="posterRef" class="poster" :class="ringColorClass">
          <!-- Background decorations -->
          <div class="poster-bg-grid"></div>
          <div class="poster-bg-glow"></div>
          <div class="poster-bg-glow-2"></div>

          <!-- ========== HERO ========== -->
          <div class="poster-hero">
            <div class="hero-top">
              <div class="hero-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                <span>清记</span>
              </div>
              <div class="hero-year">{{ year }}</div>
            </div>

            <div class="hero-center">
              <div class="hero-left-col">
                <div class="hero-tag">WEEKLY REPORT</div>
                <div class="hero-week-num">W{{ weekNum }}</div>
                <div class="hero-date-range">{{ dateRange }}</div>
                <div class="hero-week-label">{{ weekLabel }}</div>
              </div>
              <div class="hero-right-col">
                <div class="ring-wrap">
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    <!-- Track -->
                    <circle cx="65" cy="65" :r="RADIUS" fill="none" stroke-width="6" class="ring-track"/>
                    <!-- Progress -->
                    <circle
                      cx="65" cy="65" :r="RADIUS" fill="none" stroke-width="6"
                      stroke-linecap="round"
                      :stroke-dasharray="CIRCUMFERENCE"
                      :stroke-dashoffset="ringOffset"
                      transform="rotate(-90 65 65)"
                      class="ring-fill"
                    />
                  </svg>
                  <div class="ring-text">
                    <span class="ring-num">{{ rate }}<span class="ring-pct">%</span></span>
                    <span class="ring-lbl">COMPLETION</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== STATS ROW ========== -->
          <div class="poster-stats">
            <div class="ps-item">
              <div class="ps-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div class="ps-body">
                <span class="ps-val">{{ s.tasksCompleted }}</span>
                <span class="ps-lbl">完成任务</span>
              </div>
            </div>
            <div class="ps-sep"></div>
            <div class="ps-item">
              <div class="ps-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <div class="ps-body">
                <span class="ps-val">{{ s.tasksCreated }}</span>
                <span class="ps-lbl">新增任务</span>
              </div>
            </div>
            <div class="ps-sep"></div>
            <div class="ps-item">
              <div class="ps-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div class="ps-body">
                <span class="ps-val">{{ s.totalXpGained }}</span>
                <span class="ps-lbl">经验获得</span>
              </div>
            </div>
            <div class="ps-sep"></div>
            <div class="ps-item">
              <div class="ps-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                </svg>
              </div>
              <div class="ps-body">
                <span class="ps-val">{{ s.streakDays }}</span>
                <span class="ps-lbl">连续天数</span>
              </div>
            </div>
          </div>

          <!-- ========== COMPLETED TASKS ========== -->
          <div class="poster-section">
            <div class="sec-head">
              <span class="sec-num">01</span>
              <span class="sec-title">本周完成任务</span>
              <span class="sec-count">{{ completedTasks.length }}</span>
              <div class="sec-line"></div>
            </div>
            <div v-if="completedTasks.length > 0" class="task-list">
              <div v-for="t in completedTasks.slice(0, 10)" :key="t.id" class="task-row">
                <span class="task-dot" :class="priorityMap[t.priority]?.cls || 'p-mid'"></span>
                <span class="task-name">{{ t.title }}</span>
                <span class="task-pri" :class="priorityMap[t.priority]?.cls || 'p-mid'">{{ priorityMap[t.priority]?.label || '中' }}</span>
                <span class="task-start">{{ taskStartedAt(t) }}</span>
                <span class="task-duration">{{ taskDuration(t) }}</span>
                <span class="task-date">{{ taskCompletedDate(t) }}</span>
              </div>
              <div v-if="completedTasks.length > 10" class="task-more">
                还有 {{ completedTasks.length - 10 }} 项...
              </div>
            </div>
            <div v-else class="section-empty">本周暂无完成任务</div>
          </div>

          <!-- ========== PENDING TASKS ========== -->
          <div v-if="pendingTasks.length > 0" class="poster-section">
            <div class="sec-head">
              <span class="sec-num">02</span>
              <span class="sec-title">下周跟进</span>
              <span class="sec-count">{{ pendingTasks.length }}</span>
              <div class="sec-line"></div>
            </div>
            <div class="task-list">
              <div v-for="t in pendingTasks" :key="t.id" class="task-row pending">
                <span class="task-dot" :class="priorityMap[t.priority]?.cls || 'p-mid'"></span>
                <span class="task-name">{{ t.title }}</span>
                <span class="task-due">{{ taskDueDate(t) }}</span>
              </div>
            </div>
          </div>

          <!-- ========== FOOTER ========== -->
          <div class="poster-footer">
            <div class="footer-glow"></div>
            <div class="footer-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <span class="footer-text">清记 · Auto Report</span>
              <span class="footer-sep">·</span>
              <span class="footer-date">{{ props.report.weekStart }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* =========================================================
   REPORT POSTER — Standalone visual poster
   ========================================================= */

/* ---- Overlay ---- */
.poster-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--color-overlay-md);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ---- Toolbar ---- */
.poster-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.tool-btn:hover:not(:disabled) {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.tool-btn.export:hover:not(:disabled) {
  background: var(--color-success-light);
  color: var(--color-success-text);
  border-color: var(--color-success);
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Scroll Area ---- */
.poster-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  padding: 8px 20px 40px;
  width: 100%;
}

.poster-scroll::-webkit-scrollbar {
  width: 6px;
}
.poster-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.poster-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

/* =========================================================
   THE POSTER — Fixed 440px width, self-contained design
   ========================================================= */
.poster {
  width: 540px;
  flex-shrink: 0;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  background: var(--color-surface);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
}

/* Background decorations */
.poster-bg-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle,
    var(--color-border-light) 0.5px,
    transparent 0.5px
  );
  background-size: 18px 18px;
  opacity: 0.4;
  pointer-events: none;
}

.poster-bg-glow {
  position: absolute;
  top: -100px;
  right: -80px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: var(--color-primary);
  filter: blur(80px);
  opacity: 0.08;
  pointer-events: none;
}

.poster-bg-glow-2 {
  position: absolute;
  bottom: 100px;
  left: -100px;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: var(--color-accent);
  filter: blur(70px);
  opacity: 0.06;
  pointer-events: none;
}

/* ---- HERO ---- */
.poster-hero {
  position: relative;
  z-index: 1;
  padding: 24px 28px 28px;
  background: linear-gradient(
    135deg,
    var(--color-primary-light) 0%,
    var(--color-surface) 70%
  );
  border-bottom: 1px solid var(--color-border-light);
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}

.hero-year {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1em;
}

.hero-center {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hero-left-col {
  flex: 1;
  min-width: 0;
}

.hero-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--color-primary);
  background: var(--color-surface);
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 10px;
  border: 1px solid var(--color-border);
}

.hero-week-num {
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
  color: var(--color-text-1);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 6px;
}

.hero-date-range {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  margin-bottom: 2px;
}

.hero-week-label {
  font-size: 11px;
  color: var(--color-text-3);
}

/* Ring */
.hero-right-col {
  flex-shrink: 0;
}

.ring-wrap {
  position: relative;
  width: 130px;
  height: 130px;
}

.ring-track {
  stroke: var(--color-border);
}

.ring-fill {
  transition: stroke-dashoffset 0.8s ease;
}

.poster.high .ring-fill { stroke: var(--color-success); }
.poster.mid .ring-fill { stroke: var(--color-warning); }
.poster.low .ring-fill { stroke: var(--color-danger); }

.ring-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ring-num {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.poster.high .ring-num { color: var(--color-success-text); }
.poster.mid .ring-num { color: var(--color-warning-text); }
.poster.low .ring-num { color: var(--color-danger-text); }

.ring-pct {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.6;
}

.ring-lbl {
  font-size: 8px;
  font-weight: 600;
  color: var(--color-text-4);
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}

/* ---- STATS ROW ---- */
.poster-stats {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 16px 28px;
  background: var(--color-bg-3);
  border-bottom: 1px solid var(--color-border-light);
}

.ps-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ps-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  flex-shrink: 0;
  border: 1px solid var(--color-border);
}

.ps-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.ps-val {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.ps-lbl {
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-4);
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-sep {
  width: 1px;
  height: 28px;
  background: var(--color-border);
  flex-shrink: 0;
  margin: 0 4px;
}

/* ---- SECTIONS ---- */
.poster-section {
  position: relative;
  z-index: 1;
  padding: 20px 28px;
}

.sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.sec-num {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--color-border);
}

.sec-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-1);
  flex-shrink: 0;
}

.sec-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-4);
  background: var(--color-bg-4);
  padding: 1px 6px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.sec-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    var(--color-border) 0%,
    transparent 100%
  );
}

/* ---- TASK LIST ---- */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  transition: all 0.2s;
}

.task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-dot.p-high { background: var(--color-danger); }
.task-dot.p-mid { background: var(--color-warning); }
.task-dot.p-low { background: var(--color-success); }

.task-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.task-pri {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.task-pri.p-high { color: var(--color-danger-text); background: var(--color-danger-light); }
.task-pri.p-mid { color: var(--color-warning-text); background: var(--color-warning-light); }
.task-pri.p-low { color: var(--color-success-text); background: var(--color-success-light); }

.task-date {
  font-size: 10px;
  color: var(--color-text-4);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
}

.task-start {
  font-size: 10px;
  color: var(--color-text-4);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
}

.task-duration {
  font-size: 10px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 56px;
  text-align: right;
  font-weight: 600;
  white-space: nowrap;
}

.task-row.pending .task-due {
  font-size: 10px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
  font-weight: 600;
}

.task-more {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-4);
  padding: 8px 0 2px;
}

.section-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-4);
  background: var(--color-bg-3);
  border-radius: 8px;
  border: 1px dashed var(--color-border);
}

/* ---- FOOTER ---- */
.poster-footer {
  position: relative;
  z-index: 1;
  padding: 20px 28px 24px;
  border-top: 1px solid var(--color-border-light);
}

.footer-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--color-primary) 0%,
    var(--color-accent) 35%,
    var(--color-success) 70%,
    transparent 100%
  );
  opacity: 0.4;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-text-4);
  font-size: 11px;
}

.footer-text {
  font-weight: 600;
  color: var(--color-text-3);
}

.footer-sep {
  opacity: 0.4;
}

.footer-date {
  font-variant-numeric: tabular-nums;
}
</style>
