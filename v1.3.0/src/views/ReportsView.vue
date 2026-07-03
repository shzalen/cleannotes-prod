<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWeeklyReportStore, getMonday, getSunday, getWeekLabel, getWeekNumber, getCurrentWeekMonday } from '@/stores/weeklyReport'
import { toLocalDate } from '@/utils/time'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = useWeeklyReportStore()

const selectedWeekStart = ref<string | null>(null)
const deleteConfirmVisible = ref(false)
const deleteTargetId = ref<string | null>(null)
const deleteTargetLabel = ref('')

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
const RING_RADIUS = 38
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

function handleGenerate() {
  const report = store.generateReport(pickerWeekStart.value)
  selectedWeekStart.value = report.weekStart
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
</script>

<template>
  <div class="reports-view">
    <!-- Left Panel: Report List -->
    <aside class="reports-sidebar">
      <div class="sidebar-header">
        <div class="header-top">
          <h2 class="sidebar-title">周报</h2>
          <span class="report-count" v-if="store.sortedReports.length > 0">{{ store.sortedReports.length }}</span>
        </div>
        <p class="sidebar-subtitle">每周工作回顾与总结</p>
      </div>

      <!-- Week Picker -->
      <div class="week-picker">
        <button class="picker-nav" @click="handleWeekChange(-1)" title="上一周">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="picker-center">
          <span class="picker-label">{{ pickerLabel }}</span>
          <span class="picker-range">{{ pickerDateRange }}</span>
        </div>
        <button class="picker-nav" @click="handleWeekChange(1)" :disabled="isCurrentWeek" title="下一周">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- Generate Button -->
      <button
        class="generate-btn"
        :class="{ regenerating: hasReportForPickerWeek }"
        @click="handleGenerate"
      >
        <svg v-if="!hasReportForPickerWeek" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span>{{ hasReportForPickerWeek ? '重新生成' : '生成本周周报' }}</span>
      </button>

      <!-- Report Cards -->
      <div v-if="store.sortedReports.length === 0" class="sidebar-empty">
        <div class="empty-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <p class="empty-text">暂无周报记录</p>
        <p class="empty-hint">选择上方周数，点击生成按钮</p>
      </div>

      <div v-else class="reports-list">
        <div
          v-for="report in store.sortedReports"
          :key="report.id"
          class="report-card"
          :class="{ active: selectedWeekStart === report.weekStart }"
          :style="{ '--card-accent-color': report.summary.completionRate >= 80 ? 'var(--color-success)' : report.summary.completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }"
          @click="selectReport(report.weekStart)"
        >
          <div class="card-accent-bar"></div>
          <div class="card-body">
            <div class="card-top">
              <div class="card-week-info">
                <span class="card-week-num">W{{ getWeekNumber(report.weekStart) }}</span>
                <span class="card-week-label">{{ getWeekLabel(report.weekStart) }}</span>
              </div>
              <button
                class="card-delete"
                title="删除"
                @click.stop="handleDelete(report.id, getWeekLabel(report.weekStart))"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>

            <!-- 完成率进度条 -->
            <div class="card-progress">
              <div class="progress-info">
                <span class="progress-label">完成率</span>
                <span class="progress-value" :class="rateClass(report.summary.completionRate)">{{ report.summary.completionRate }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :class="rateClass(report.summary.completionRate)"
                  :style="{ width: report.summary.completionRate + '%' }"
                ></div>
              </div>
            </div>

            <div class="card-stats">
              <div class="stat-item">
                <span class="stat-value">{{ report.summary.tasksCompleted }}</span>
                <span class="stat-label">完成</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ report.summary.tasksCreated }}</span>
                <span class="stat-label">新增</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ report.summary.totalXpGained }}</span>
                <span class="stat-label">XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right Panel: Report Detail -->
    <main class="reports-main">
      <template v-if="selectedReport">
        <div class="report-detail">
          <!-- Report Hero -->
          <div class="report-hero">
            <div class="hero-decoration"></div>
            <div class="hero-content">
              <div class="hero-left">
                <div class="hero-badge">WEEKLY REPORT</div>
                <h1 class="hero-title">{{ getWeekLabel(selectedReport.weekStart) }}</h1>
                <p class="hero-meta">
                  <span class="meta-date">{{ selectedDateRange }}</span>
                  <span class="meta-dot"></span>
                  <span class="meta-time">生成于 {{ formatGeneratedAt(selectedReport.updatedAt || selectedReport.createdAt) }}</span>
                </p>
              </div>
              <div class="hero-right">
                <div class="completion-ring">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" :r="RING_RADIUS" fill="none" stroke="var(--color-bg-4)" stroke-width="6"/>
                    <circle
                      cx="48" cy="48" :r="RING_RADIUS" fill="none"
                      :stroke="ringColor"
                      stroke-width="6"
                      stroke-linecap="round"
                      :stroke-dasharray="RING_CIRCUMFERENCE"
                      :stroke-dashoffset="ringOffset"
                      transform="rotate(-90 48 48)"
                      style="transition: stroke-dashoffset 0.6s ease;"
                    />
                  </svg>
                  <div class="ring-center">
                    <span class="ring-value" :class="rateClass(ringRate)">{{ ringRate }}%</span>
                    <span class="ring-label">完成率</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Report Content (rendered HTML) -->
          <div class="report-content" v-html="selectedReport.content"></div>

          <!-- Report Footer -->
          <div class="report-footer">
            <div class="footer-brand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>清记 · 自动生成</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="store.sortedReports.length > 0">
        <div class="report-empty">
          <div class="empty-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p>从左侧选择一份周报查看</p>
        </div>
      </template>

      <template v-else>
        <div class="report-empty">
          <div class="empty-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p>选择周数并点击「生成周报」开始</p>
        </div>
      </template>
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
  </div>
</template>

<style scoped>
.reports-view {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
}

/* ---- Left Sidebar ---- */
.reports-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  overflow: hidden;
}

.sidebar-header {
  padding: 24px 20px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
}

.header-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -0.02em;
}

.report-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  background: var(--color-bg-3);
  padding: 2px 8px;
  border-radius: 10px;
  line-height: 1.4;
}

.sidebar-subtitle {
  font-size: 12px;
  color: var(--color-text-4);
  margin: 4px 0 0;
}

/* Week Picker */
.week-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 20px;
  flex-shrink: 0;
}

.picker-nav {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.picker-nav:hover:not(:disabled) {
  background: var(--color-bg-3);
  color: var(--color-text-1);
  border-color: var(--color-text-4);
}

.picker-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.picker-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.picker-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  user-select: none;
}

.picker-range {
  font-size: 11px;
  color: var(--color-text-4);
  user-select: none;
}

/* Generate Button */
.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 0 20px 16px;
  padding: 10px 16px;
  border: none;
  background: var(--color-success);
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.generate-btn:hover {
  background: var(--color-success-text);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent);
}

.generate-btn.regenerating {
  background: var(--color-warning);
}

.generate-btn.regenerating:hover {
  background: var(--color-warning-text);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-warning) 30%, transparent);
}

/* Empty State */
.sidebar-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-4);
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-3);
  margin: 0 0 4px;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-4);
  margin: 0;
}

/* Report Cards */
.reports-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reports-list::-webkit-scrollbar {
  width: 6px;
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

.report-card {
  display: flex;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.18s;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 118px;
}

.report-card:hover {
  border-color: var(--color-text-4);
  box-shadow: 0 2px 10px var(--color-shadow);
}

.report-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.card-accent-bar {
  width: 3px;
  flex-shrink: 0;
  background: var(--card-accent-color, var(--color-primary));
}

.card-body {
  flex: 1;
  padding: 14px 16px;
  min-width: 0;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-week-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.card-week-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-3);
  background: var(--color-bg-3);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.card-week-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-delete {
  border: none;
  background: none;
  color: var(--color-text-4);
  cursor: pointer;
  padding: 4px;
  border-radius: 5px;
  transition: all 0.15s;
  display: flex;
  opacity: 0;
  flex-shrink: 0;
}

.report-card:hover .card-delete {
  opacity: 1;
}

.card-delete:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

/* Progress Bar */
.card-progress {
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.progress-label {
  font-size: 11px;
  color: var(--color-text-4);
}

.progress-value {
  font-size: 13px;
  font-weight: 700;
}

.progress-value.high { color: var(--color-success-text); }
.progress-value.mid { color: var(--color-warning-text); }
.progress-value.low { color: var(--color-danger-text); }

.progress-bar {
  height: 4px;
  background: var(--color-bg-4);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.progress-fill.high { background: var(--color-success); }
.progress-fill.mid { background: var(--color-warning); }
.progress-fill.low { background: var(--color-danger); }

/* Card Stats */
.card-stats {
  display: flex;
  align-items: center;
  gap: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.stat-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-1);
  line-height: 1;
}

.stat-label {
  font-size: 10px;
  color: var(--color-text-4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ---- Right Main ---- */
.reports-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  background: var(--color-bg-1);
}

.report-detail {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 48px 48px;
}

/* ---- Report Hero ---- */
.report-hero {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 4px var(--color-shadow);
}

.hero-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    var(--color-primary),
    var(--color-accent),
    var(--color-success)
  );
}

.hero-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 36px 40px;
}

.hero-left {
  flex: 1;
  min-width: 0;
}

.hero-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 4px 10px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 12px;
}

.hero-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0 0 10px;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  color: var(--color-text-3);
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-4);
  flex-shrink: 0;
}

/* Completion Ring */
.hero-right {
  flex-shrink: 0;
}

.completion-ring {
  position: relative;
  width: 96px;
  height: 96px;
}

.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.ring-value {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.ring-value.high { color: var(--color-success-text); }
.ring-value.mid { color: var(--color-warning-text); }
.ring-value.low { color: var(--color-danger-text); }

.ring-label {
  font-size: 10px;
  color: var(--color-text-4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Report Footer */
.report-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-4);
}

/* Empty State (right) */
.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
  font-size: 14px;
}

.report-empty .empty-icon {
  margin-bottom: 16px;
}

/* ---- Report Content (rendered HTML from store) ---- */
.report-content {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.7;
}

/* Section wrapper */
.report-content :deep(.report-section) {
  margin-bottom: 36px;
}

/* Section header with number */
.report-content :deep(.section-header) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.report-content :deep(.section-num) {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.report-content :deep(.section-title-text) {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  flex-shrink: 0;
}

.report-content :deep(.section-line) {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--color-border), transparent);
}

/* Stat Cards Grid */
.report-content :deep(.stat-grid) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.report-content :deep(.stat-card) {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: all 0.18s;
  position: relative;
  overflow: hidden;
}

.report-content :deep(.stat-card::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-accent, var(--color-primary));
  opacity: 0.8;
}

.report-content :deep(.stat-card:hover) {
  border-color: var(--card-accent, var(--color-primary));
  box-shadow: 0 4px 16px var(--color-shadow);
  transform: translateY(-1px);
}

.report-content :deep(.sc-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--card-bg, var(--color-bg-3));
  color: var(--card-accent, var(--color-primary));
  flex-shrink: 0;
}

.report-content :deep(.sc-body) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.report-content :deep(.sc-value) {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.report-content :deep(.sc-label) {
  font-size: 11px;
  color: var(--color-text-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Task Table */
.report-content :deep(.task-table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.report-content :deep(.task-table th) {
  padding: 11px 16px;
  text-align: left;
  background: var(--color-bg-3);
  font-weight: 600;
  color: var(--color-text-2);
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
}

.report-content :deep(.task-table td) {
  padding: 11px 16px;
  color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border-light);
}

.report-content :deep(.task-table tr:last-child td) {
  border-bottom: none;
}

.report-content :deep(.task-table tbody tr) {
  transition: background 0.12s;
}

.report-content :deep(.task-table tbody tr:hover td) {
  background: var(--color-bg-3);
}

.report-content :deep(.task-table .task-name) {
  font-weight: 500;
  color: var(--color-text-1);
}

/* Priority Badge */
.report-content :deep(.pri-badge) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

/* Todo List */
.report-content :deep(.todo-list) {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-content :deep(.todo-list li) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  transition: all 0.15s;
}

.report-content :deep(.todo-list li:hover) {
  border-color: var(--color-border);
  box-shadow: 0 1px 4px var(--color-shadow);
}

.report-content :deep(.todo-list .todo-dot) {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 6px;
  flex-shrink: 0;
}

.report-content :deep(.todo-content) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.report-content :deep(.todo-title) {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
}

.report-content :deep(.todo-desc) {
  font-size: 12px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pending List */
.report-content :deep(.pending-list) {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-content :deep(.pending-list li) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  transition: all 0.15s;
}

.report-content :deep(.pending-list li:hover) {
  border-color: var(--color-border);
  box-shadow: 0 1px 4px var(--color-shadow);
}

.report-content :deep(.pending-list .pending-pri) {
  width: 3px;
  height: 20px;
  border-radius: 2px;
  flex-shrink: 0;
}

.report-content :deep(.pending-list .pending-title) {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-content :deep(.pending-list .pending-due) {
  font-size: 11px;
  color: var(--color-text-4);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Empty paragraph */
.report-content :deep(.section-empty) {
  padding: 20px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-4);
  background: var(--color-bg-3);
  border-radius: 10px;
  border: 1px dashed var(--color-border);
}
</style>
