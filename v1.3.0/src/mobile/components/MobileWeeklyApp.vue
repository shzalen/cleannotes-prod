<script setup lang="ts">
/**
 * 移动端子应用：周报列表与查看
 */
import { ref, computed, onMounted } from 'vue'
import { useWeeklyReportStore, getWeekLabel } from '@/stores/weeklyReport'
import DOMPurify from 'dompurify'
import { showToast } from 'vant'

defineOptions({ name: 'MobileWeeklyApp' })

const reportStore = useWeeklyReportStore()

const reports = computed(() => reportStore.sortedReports)
const loading = ref(false)

// 查看报告详情
const viewingReport = ref<any>(null)
const showDetail = ref(false)

async function viewReport(report: any) {
  viewingReport.value = report
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  viewingReport.value = null
}

const renderedContent = computed(() => {
  if (!viewingReport.value?.content) return ''
  return DOMPurify.sanitize(viewingReport.value.content)
})

async function doGenerate(weekStart: string) {
  loading.value = true
  try {
    await reportStore.generateReport(weekStart)
    reportStore.generateAiSummary(weekStart)
    showToast('周报已生成')
  } catch (e) {
    showToast('生成失败')
  }
  loading.value = false
}

onMounted(() => {
  reportStore.load()
})
</script>

<template>
  <div class="weekly-app">
    <div class="weekly-list" v-if="reports.length > 0">
      <div
        v-for="report in reports"
        :key="report.id"
        class="weekly-card"
        @click="viewReport(report)"
      >
        <div class="weekly-card__left">
          <span class="weekly-card__week">W{{ getWeekLabel(report.weekStart) }}</span>
          <span class="weekly-card__dates">{{ report.weekStart }} ~ {{ report.weekEnd }}</span>
        </div>
        <div class="weekly-card__right">
          <span class="weekly-card__rate" :class="{
            'rate-high': report.summary?.completionRate >= 80,
            'rate-mid': report.summary?.completionRate >= 50 && report.summary?.completionRate < 80,
            'rate-low': report.summary?.completionRate < 50,
          }">
            {{ report.summary?.completionRate ?? 0 }}%
          </span>
        </div>
      </div>
    </div>

    <div v-else class="app-empty">
      <p>暂无周报</p>
    </div>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      teleport="body"
      :style="{ height: '85%', '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="detail-view" v-if="viewingReport">
        <div class="detail-view__header">
          <div class="detail-view__header-left">
            <span class="detail-view__week-badge">W{{ getWeekLabel(viewingReport.weekStart) }}</span>
            <span class="detail-view__dates">{{ viewingReport.weekStart }} ~ {{ viewingReport.weekEnd }}</span>
          </div>
          <button class="detail-view__close" @click="closeDetail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <!-- AI 总结 -->
        <div class="detail-view__ai" v-if="viewingReport.aiSummary">
          <div class="ai-summary-label">AI 智能总结</div>
          <p class="ai-summary-text">{{ viewingReport.aiSummary }}</p>
        </div>
        <div class="detail-view__ai detail-view__ai--loading" v-else-if="viewingReport.aiSummaryStatus === 'generating'">
          <p class="ai-summary-text">AI 总结生成中...</p>
        </div>

        <!-- 统计概览 -->
        <div class="detail-view__stats" v-if="viewingReport.summary">
          <div class="stat-item">
            <span class="stat-value">{{ viewingReport.summary.tasksCreated }}</span>
            <span class="stat-label">创建任务</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ viewingReport.summary.tasksCompleted }}</span>
            <span class="stat-label">完成任务</span>
          </div>
          <div class="stat-item">
            <span class="stat-value stat-value--rate" :class="{
              'rate-high': viewingReport.summary.completionRate >= 80,
              'rate-mid': viewingReport.summary.completionRate >= 50 && viewingReport.summary.completionRate < 80,
              'rate-low': viewingReport.summary.completionRate < 50,
            }">
              {{ viewingReport.summary.completionRate }}%
            </span>
            <span class="stat-label">完成率</span>
          </div>
        </div>

        <!-- 内容 -->
        <div class="detail-view__body" v-html="renderedContent"></div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.weekly-app { padding: 12px 12px 80px; min-height: 100%; }

.weekly-list { display: flex; flex-direction: column; gap: 8px; }

.weekly-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
  cursor: pointer;
}
.weekly-card:active { transform: scale(0.98); }

.weekly-card__left { display: flex; flex-direction: column; gap: 2px; }
.weekly-card__week { font-size: 16px; font-weight: 600; color: var(--color-text-1); }
.weekly-card__dates { font-size: 12px; color: var(--color-text-3); }
.weekly-card__rate { font-size: 20px; font-weight: 700; }
.rate-high { color: var(--color-success); }
.rate-mid { color: var(--color-warning); }
.rate-low { color: var(--color-danger); }

.app-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 0; color: var(--color-text-3); font-size: 14px; }

/* 详情弹窗 */
.detail-view { display: flex; flex-direction: column; height: 100%; }
.detail-view__header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--color-border-light); flex-shrink: 0; }
.detail-view__header-left { display: flex; align-items: center; gap: 8px; }
.detail-view__week-badge { padding: 4px 10px; font-size: 13px; font-weight: 600; background: var(--color-primary); color: #fff; border-radius: 8px; }
.detail-view__dates { font-size: 12px; color: var(--color-text-3); }
.detail-view__close { border: none; background: transparent; color: var(--color-text-3); display: flex; padding: 4px; cursor: pointer; }
.detail-view__close svg { width: 20px; height: 20px; }

.detail-view__ai { margin: 12px 16px; padding: 12px 14px; background: var(--color-bg-3); border-radius: 10px; border-left: 3px solid var(--color-primary); flex-shrink: 0; }
.detail-view__ai--loading { opacity: 0.6; }
.ai-summary-label { font-size: 11px; font-weight: 600; color: var(--color-primary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.ai-summary-text { margin: 0; font-size: 13px; color: var(--color-text-2); line-height: 1.6; }

.detail-view__stats { display: flex; gap: 0; margin: 0 16px; border-radius: 10px; overflow: hidden; background: var(--color-bg-3); flex-shrink: 0; }
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10px 8px; }
.stat-value { font-size: 18px; font-weight: 700; color: var(--color-text-1); }
.stat-value--rate { font-size: 20px; }
.stat-label { font-size: 10px; color: var(--color-text-3); margin-top: 2px; }

.detail-view__body { flex: 1; overflow-y: auto; padding: 12px 16px 16px; font-size: 13px; line-height: 1.7; color: var(--color-text-2); word-break: break-word; }
/* 基础 Markdown 样式 */
.detail-view__body :deep(h2) { font-size: 15px; font-weight: 600; margin: 10px 0 6px; color: var(--color-text-1); }
.detail-view__body :deep(table) { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.detail-view__body :deep(th) { background: var(--color-bg-3); padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--color-border); }
.detail-view__body :deep(td) { padding: 6px 8px; border-bottom: 1px solid var(--color-border-light); }
.detail-view__body :deep(p) { margin: 4px 0; }
.detail-view__body :deep(strong) { color: var(--color-text-1); }
</style>
