<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWeeklyReportStore, getMonday, getSunday, getWeekLabel, getWeekNumber, getCurrentWeekMonday } from '@/stores/weeklyReport'
import { toLocalDate } from '@/utils/time'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ReportPoster from '@/components/ReportPoster.vue'
import DOMPurify from 'dompurify'

const store = useWeeklyReportStore()

const selectedWeekStart = ref<string | null>(null)
const deleteConfirmVisible = ref(false)
const deleteTargetId = ref<string | null>(null)
const deleteTargetLabel = ref('')
const posterVisible = ref(false)

// 周选择相关
const pickerWeekStart = ref(getCurrentWeekMonday())
const pickerWeekEnd = computed(() => getSunday(pickerWeekStart.value))
const pickerLabel = computed(() => getWeekLabel(pickerWeekStart.value))
const pickerWeekNum = computed(() => getWeekNumber(pickerWeekStart.value))

// 是否选中了当前周
const isCurrentWeek = computed(() => pickerWeekStart.value === getCurrentWeekMonday())

// 当前选中的报告
const selectedReport = computed(() => {
  if (!selectedWeekStart.value) return null
  return store.getReportByWeek(selectedWeekStart.value) || null
})

// 当前周是否已有报告
const hasReportForPickerWeek = computed(() => {
  return !!store.getReportByWeek(pickerWeekStart.value)
})

// 圆环进度计算
const RING_RADIUS = 32
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const ringRate = computed(() => selectedReport.value?.summary.completionRate ?? 0)
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - ringRate.value / 100))
const ringColor = computed(() => {
  const r = ringRate.value
  if (r >= 80) return 'var(--color-success)'
  if (r >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
})

onMounted(() => {
  store.load()
  if (store.sortedReports.length > 0) {
    selectedWeekStart.value = store.sortedReports[0].weekStart
    pickerWeekStart.value = store.sortedReports[0].weekStart
  }
})

function selectReport(weekStart: string) {
  selectedWeekStart.value = weekStart
  pickerWeekStart.value = weekStart
}

const generating = ref(false)

async function handleGenerate() {
  // Phase 1: 立即生成报告（带 AI generating 占位）
  const report = await store.generateReport(pickerWeekStart.value)
  selectedWeekStart.value = report.weekStart

  // Phase 2: 后台异步调用 AI 并更新
  generating.value = true
  store.generateAiSummary(pickerWeekStart.value).finally(() => {
    generating.value = false
  })
}

function handleDelete(id: string, label: string) {
  deleteTargetId.value = id
  deleteTargetLabel.value = label
  deleteConfirmVisible.value = true
}

function confirmDelete() {
  if (deleteTargetId.value) {
    store.deleteReport(deleteTargetId.value)
    if (selectedWeekStart.value && store.getReportByWeek(selectedWeekStart.value)) {
      // still exists
    } else {
      selectedWeekStart.value = store.sortedReports.length > 0 ? store.sortedReports[0].weekStart : null
      if (selectedWeekStart.value) pickerWeekStart.value = selectedWeekStart.value
    }
  }
  deleteConfirmVisible.value = false
  deleteTargetId.value = null
}

function handleWeekChange(delta: number) {
  const d = new Date(pickerWeekStart.value + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  pickerWeekStart.value = toLocalDate(d)
}

// 日期范围显示
const pickerDateRange = computed(() => {
  const [sy, sm, sd] = pickerWeekStart.value.split('-').map(Number)
  const [ey, em, ed] = pickerWeekEnd.value.split('-').map(Number)
  return `${sm}月${sd}日 — ${em}月${ed}日`
})

// 选中报告的日期范围
const selectedDateRange = computed(() => {
  if (!selectedReport.value) return ''
  const [sy, sm, sd] = selectedReport.value.weekStart.split('-').map(Number)
  const [ey, em, ed] = selectedReport.value.weekEnd.split('-').map(Number)
  return `${sm}月${sd}日 — ${em}月${ed}日`
})

// 格式化生成时间
function formatGeneratedAt(iso: string): string {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 16)
}

// 卡片完成率颜色 class
function rateClass(rate: number): string {
  if (rate >= 80) return 'high'
  if (rate >= 50) return 'mid'
  return 'low'
}

// 报告列表项的日期范围
function reportDateRange(weekStart: string): string {
  const ws = weekStart
  const we = getSunday(weekStart)
  const [, sm, sd] = ws.split('-').map(Number)
  const [, em, ed] = we.split('-').map(Number)
  return `${sm}/${sd} - ${em}/${ed}`
}
</script>

<template>
  <div class="reports-view">
    <!-- Grid Pattern Overlay -->
    <div class="grid-overlay"></div>

    <!-- =========== Left Panel =========== -->
    <aside class="reports-sidebar">
      <!-- Header -->
      <div class="sidebar-header">
        <h2 class="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          周报
          <span class="report-count" v-if="store.sortedReports.length > 0">{{ store.sortedReports.length }}</span>
        </h2>
        <button
          class="btn-generate"
          :class="{ regenerating: hasReportForPickerWeek, generating: generating }"
          @click="handleGenerate"
          :disabled="generating"
          :title="hasReportForPickerWeek ? '重新生成本周' : '生成本周周报'"
        >
          <svg v-if="generating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else-if="!hasReportForPickerWeek" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>{{ generating ? 'AI分析中...' : hasReportForPickerWeek ? '重新生成' : '生成' }}</span>
        </button>
      </div>

      <!-- Week Picker -->
      <div class="week-picker">
        <button class="picker-nav" @click="handleWeekChange(-1)" title="上一周">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="picker-center">
          <span class="picker-week-num">W{{ pickerWeekNum }}</span>
          <span class="picker-label">{{ pickerLabel }}</span>
          <span class="picker-range">{{ pickerDateRange }}</span>
        </div>
        <button class="picker-nav" @click="handleWeekChange(1)" :disabled="isCurrentWeek" title="下一周">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- Decorative bar -->
      <div class="header-bar"></div>

      <!-- Report List -->
      <div v-if="store.sortedReports.length === 0" class="list-empty">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="14" x2="16" y2="14"/>
            <line x1="8" y1="18" x2="12" y2="18"/>
          </svg>
        </div>
        <p class="empty-text">暂无周报数据</p>
        <p class="empty-hint">选择周数后点击生成</p>
      </div>

      <div v-else class="reports-list">
        <div
          v-for="report in store.sortedReports"
          :key="report.id"
          class="report-item"
          :class="{ active: selectedWeekStart === report.weekStart }"
          @click="selectReport(report.weekStart)"
        >
          <div class="ri-main">
            <span class="ri-week-num">W{{ getWeekNumber(report.weekStart) }}</span>
            <span class="ri-label">{{ getWeekLabel(report.weekStart) }}</span>
            <span class="ri-rate" :class="rateClass(report.summary.completionRate)">{{ report.summary.completionRate }}%</span>
          </div>
          <div class="ri-meta">
            <span class="ri-stats">{{ report.summary.tasksCompleted }} done · {{ report.summary.tasksCreated }} new · {{ report.summary.totalXpGained }} XP</span>
            <span class="ri-date">{{ reportDateRange(report.weekStart) }}</span>
          </div>
          <div class="ri-actions">
            <button class="ri-btn ri-btn-del" @click.stop="handleDelete(report.id, getWeekLabel(report.weekStart))" title="删除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- =========== Right Panel =========== -->
    <main class="reports-main">
      <!-- Empty states -->
      <div v-if="!selectedReport" class="detail-empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p class="empty-text">{{ store.sortedReports.length > 0 ? '选择左侧周报查看详情' : '选择周数并点击「生成」开始' }}</p>
      </div>

      <!-- Active detail -->
      <div v-else class="detail-active">
        <!-- Header bar (like memo editor header) -->
        <div class="detail-header">
          <div class="dh-left">
            <span class="dh-week-badge">W{{ getWeekNumber(selectedReport.weekStart) }}</span>
            <h2 class="dh-title">{{ getWeekLabel(selectedReport.weekStart) }}</h2>
            <span class="dh-range">{{ selectedDateRange }}</span>
          </div>
          <div class="dh-right">
            <!-- Completion ring -->
            <div class="dh-ring">
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" :r="RING_RADIUS" fill="none" stroke="var(--color-border)" stroke-width="4"/>
                <circle
                  cx="34" cy="34" :r="RING_RADIUS" fill="none"
                  :stroke="ringColor"
                  stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="RING_CIRCUMFERENCE"
                  :stroke-dashoffset="ringOffset"
                  transform="rotate(-90 34 34)"
                  class="ring-progress"
                />
              </svg>
              <span class="dh-ring-val" :class="rateClass(ringRate)">{{ ringRate }}%</span>
            </div>
            <button class="dh-btn poster-btn" @click="posterVisible = true" title="海报模式">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              <span>海报</span>
            </button>
            <button class="dh-btn dh-btn-del" @click="handleDelete(selectedReport.id, getWeekLabel(selectedReport.weekStart))" title="删除此报告">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="detail-content">
          <div class="content-inner" v-html="DOMPurify.sanitize(selectedReport.content)"></div>

          <!-- Report Footer -->
          <div class="detail-footer">
            <div class="footer-line"></div>
            <div class="footer-brand">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <span>清记 · Auto Report</span>
              <span class="footer-sep">·</span>
              <span class="footer-meta">生成于 {{ formatGeneratedAt(selectedReport.updatedAt || selectedReport.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="删除周报"
      :message="`确定要删除「${deleteTargetLabel}」的报告吗？此操作不可撤销。`"
      confirm-text="删除"
      type="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirmVisible = false"
    />

    <!-- Poster Mode -->
    <ReportPoster
      v-if="posterVisible && selectedReport"
      :report="selectedReport"
      @close="posterVisible = false"
    />
  </div>
</template>

<style scoped>
/* =========================================================
   REPORTS VIEW — Memo-style layout with tech aesthetic
   ========================================================= */

/* ---- Animations ---- */
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- Layout ---- */
.reports-view {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
  position: relative;
}

/* Subtle dot grid overlay */
.grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(
    circle,
    var(--color-border-light) 0.5px,
    transparent 0.5px
  );
  background-size: 24px 24px;
  opacity: 0.3;
}

/* =========== Left Sidebar (300px, memo-style) =========== */
.reports-sidebar {
  width: 300px;
  min-width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-2);
  z-index: 1;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.sidebar-title svg {
  color: var(--color-text-3);
}

.report-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 6px;
  border-radius: 6px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  margin-left: 2px;
}

/* Generate button — compact */
.btn-generate {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--color-success-light);
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: #fff;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.btn-generate::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
  animation: shimmer 3s ease-in-out infinite;
}

.btn-generate:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.btn-generate.regenerating {
  background: linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 60%, var(--color-danger)));
}

.btn-generate.generating {
  opacity: 0.85;
  pointer-events: auto;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

/* Week Picker */
.week-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 16px 10px;
  flex-shrink: 0;
}

.picker-nav {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-3);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.picker-nav:hover:not(:disabled) {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.picker-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.picker-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex: 1;
}

.picker-week-num {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}

.picker-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-1);
  user-select: none;
}

.picker-range {
  font-size: 10px;
  color: var(--color-text-4);
  user-select: none;
  font-variant-numeric: tabular-nums;
}

/* Decorative accent bar */
.header-bar {
  height: 2px;
  margin: 0 16px 8px;
  background: linear-gradient(
    90deg,
    var(--color-primary) 0%,
    var(--color-accent) 40%,
    var(--color-success) 80%,
    transparent 100%
  );
  border-radius: 1px;
  opacity: 0.4;
  flex-shrink: 0;
}

/* Empty state */
.list-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.list-empty .empty-icon {
  color: var(--color-text-4);
  margin-bottom: 12px;
  opacity: 0.25;
}

.list-empty .empty-text {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-3);
}

.list-empty .empty-hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-4);
}

/* Report list — memo-style items */
.reports-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.reports-list::-webkit-scrollbar {
  width: 5px;
}
.reports-list::-webkit-scrollbar-track {
  background: transparent;
}
.reports-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
.reports-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-4);
}

/* Report list item — compact like memo */
.report-item {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}

.report-item:hover {
  background: var(--color-bg-4);
}

.report-item.active {
  background: var(--color-primary-light);
}

.report-item:hover .ri-actions {
  opacity: 1;
}

.ri-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ri-week-num {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

.report-item.active .ri-week-num {
  background: var(--color-surface);
}

.ri-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.report-item.active .ri-label {
  color: var(--color-primary);
}

.ri-rate {
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.ri-rate.high { color: var(--color-success-text); }
.ri-rate.mid { color: var(--color-warning-text); }
.ri-rate.low { color: var(--color-danger-text); }

.ri-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  padding-left: 2px;
}

.ri-stats {
  font-size: 10px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.ri-date {
  font-size: 10px;
  color: var(--color-text-4);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.ri-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.12s;
}

.ri-btn {
  width: 24px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}

.ri-btn-del:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* =========== Right Panel (memo-style) =========== */
.reports-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
  z-index: 1;
  position: relative;
}

/* Empty state */
.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-3);
}

.detail-empty .empty-icon {
  color: var(--color-text-4);
  opacity: 0.3;
}

.detail-empty .empty-text {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

/* Active detail */
.detail-active {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  animation: fadeIn 0.35s ease;
}

/* Header bar */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
}

.dh-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dh-week-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 3px 8px;
  border-radius: 5px;
  flex-shrink: 0;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.dh-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dh-range {
  font-size: 12px;
  color: var(--color-text-4);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.dh-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* Completion ring — compact */
.dh-ring {
  position: relative;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-progress {
  transition: stroke-dashoffset 0.8s ease;
}

.dh-ring-val {
  position: absolute;
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.dh-ring-val.high { color: var(--color-success-text); }
.dh-ring-val.mid { color: var(--color-warning-text); }
.dh-ring-val.low { color: var(--color-danger-text); }

/* Header buttons */
.dh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-3);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.dh-btn:hover {
  background: var(--color-bg-3);
  border-color: var(--color-border);
  color: var(--color-text-1);
}

.poster-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.dh-btn-del:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* Scrollable content */
.detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px;
}

.detail-content::-webkit-scrollbar {
  width: 5px;
}
.detail-content::-webkit-scrollbar-track {
  background: transparent;
}
.detail-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.content-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 0;
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.7;
}

/* Section wrapper */
.content-inner :deep(.report-section) {
  margin-bottom: 32px;
}

/* Section header */
.content-inner :deep(.section-header) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.content-inner :deep(.section-num) {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.content-inner :deep(.section-title-text) {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  flex-shrink: 0;
}

.content-inner :deep(.section-line) {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-primary) 30%, var(--color-border)) 0%,
    transparent 100%
  );
}

/* AI Summary Section */
.content-inner :deep(.report-section-ai) {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.content-inner :deep(.ai-summary-content) {
  position: relative;
  padding-left: 0;
}

.content-inner :deep(.ai-badge) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
  color: var(--color-accent-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.content-inner :deep(.ai-summary-content p) {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.7;
  margin: 0 0 10px 0;
}

.content-inner :deep(.ai-summary-content p:last-child) {
  margin-bottom: 0;
}

/* AI Placeholder — generating state */
.content-inner :deep(.ai-status-generating) {
  border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
}

.content-inner :deep(.ai-placeholder) {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 8px;
}

.content-inner :deep(.ai-placeholder-generating) {
  background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
}

.content-inner :deep(.ai-placeholder-text) {
  font-size: 13px;
  color: var(--color-text-3);
  line-height: 1.5;
}

.content-inner :deep(.ai-shimmer-line) {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--color-bg-3);
  position: relative;
  overflow: hidden;
  margin-bottom: 8px;
}

.content-inner :deep(.ai-shimmer-line::after) {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-accent) 20%, var(--color-surface)) 50%, transparent 100%);
  animation: shimmer 2s ease-in-out infinite;
}

/* AI Placeholder — failed state */
.content-inner :deep(.ai-status-failed) {
  border-color: color-mix(in srgb, var(--color-danger) 20%, var(--color-border));
  opacity: 0.85;
}

.content-inner :deep(.ai-placeholder-failed) {
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface));
}

.content-inner :deep(.ai-failed-icon) {
  color: var(--color-danger-text);
  flex-shrink: 0;
}

.content-inner :deep(.ai-placeholder-failed .ai-placeholder-text) {
  color: var(--color-text-4);
}

/* Stat Cards Grid */
.content-inner :deep(.stat-grid) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.content-inner :deep(.stat-card) {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}

.content-inner :deep(.stat-card::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--card-accent, var(--color-primary)), transparent);
  opacity: 0.6;
}

.content-inner :deep(.stat-card::after) {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 1px solid var(--card-accent, var(--color-primary));
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.content-inner :deep(.stat-card:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--color-shadow-md);
  border-color: transparent;
}

.content-inner :deep(.stat-card:hover::after) {
  opacity: 0.3;
}

.content-inner :deep(.sc-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--card-bg, var(--color-primary-light));
  color: var(--card-accent, var(--color-primary));
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--card-accent, var(--color-primary)) 15%, transparent);
}

.content-inner :deep(.sc-body) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.content-inner :deep(.sc-value) {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.content-inner :deep(.sc-label) {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}

/* Task Table */
.content-inner :deep(.task-table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.content-inner :deep(.task-table th) {
  padding: 10px 16px;
  text-align: left;
  background: var(--color-bg-3);
  font-weight: 700;
  color: var(--color-text-2);
  font-size: 11px;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--color-border);
  font-variant-numeric: tabular-nums;
}

.content-inner :deep(.task-table td) {
  padding: 10px 16px;
  color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border-light);
  font-variant-numeric: tabular-nums;
}

.content-inner :deep(.task-table tr:last-child td) {
  border-bottom: none;
}

.content-inner :deep(.task-table tbody tr) {
  transition: background 0.15s;
}

.content-inner :deep(.task-table tbody tr:hover td) {
  background: var(--color-bg-3);
}

.content-inner :deep(.task-table .task-name) {
  font-weight: 500;
  color: var(--color-text-1);
}

/* Priority Badge */
.content-inner :deep(.pri-badge) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

/* Todo List */
.content-inner :deep(.todo-list) {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content-inner :deep(.todo-list li) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  transition: all 0.2s;
}

.content-inner :deep(.todo-list li:hover) {
  border-color: var(--color-border);
  box-shadow: 0 2px 8px var(--color-shadow);
  transform: translateY(-1px);
}

.content-inner :deep(.todo-list .todo-dot) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 7px;
  flex-shrink: 0;
  box-shadow: 0 0 4px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.content-inner :deep(.todo-content) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.content-inner :deep(.todo-title) {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
}

.content-inner :deep(.todo-desc) {
  font-size: 12px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pending List */
.content-inner :deep(.pending-list) {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content-inner :deep(.pending-list li) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  transition: all 0.2s;
}

.content-inner :deep(.pending-list li:hover) {
  border-color: var(--color-border);
  box-shadow: 0 2px 8px var(--color-shadow);
  transform: translateY(-1px);
}

.content-inner :deep(.pending-list .pending-pri) {
  width: 3px;
  height: 22px;
  border-radius: 2px;
  flex-shrink: 0;
}

.content-inner :deep(.pending-list .pending-title) {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-inner :deep(.pending-list .pending-due) {
  font-size: 11px;
  color: var(--color-text-4);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

/* Empty paragraph */
.content-inner :deep(.section-empty) {
  padding: 20px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-4);
  background: var(--color-bg-3);
  border-radius: 10px;
  border: 1px dashed var(--color-border);
}

/* Footer */
.detail-footer {
  flex-shrink: 0;
  padding: 12px 24px 16px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.footer-line {
  height: 1px;
  background: linear-gradient(
    90deg,
    var(--color-primary) 0%,
    var(--color-accent) 30%,
    var(--color-success) 60%,
    transparent 100%
  );
  opacity: 0.2;
  margin-bottom: 10px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-4);
  letter-spacing: 0.02em;
}

.footer-sep {
  opacity: 0.4;
}

.footer-meta {
  font-variant-numeric: tabular-nums;
}
</style>
