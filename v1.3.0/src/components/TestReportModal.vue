<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'

interface TestCase {
  id: string
  name: string
  priority: string
  status: 'pass' | 'fail' | 'check'
  method: string
  note: string
}

interface SubModule {
  name: string
  cases: TestCase[]
}

interface Module {
  id: string
  name: string
  passRate: string
  cases?: TestCase[]
  subModules?: SubModule[]
}

interface Bug {
  id: string
  severity: string
  title: string
  description: string
  reproduce?: string
  status: string
}

interface ReportSummary {
  total: number
  passed: number
  failed: number
  manualCheck: number
  autoPassRate: string
  p0Total: number
  p0Passed: number
  foundBugs: number
}

interface TestReport {
  version: string
  testDate: string
  testEnv: string
  testAccount: string
  summary: ReportSummary
  modules: Module[]
  bugs: Bug[]
  findings: string[]
  recommendations: string[]
}

const props = defineProps<{
  visible: boolean
  currentVersion: string
}>()

const emit = defineEmits<{
  close: []
}>()

// State
const view = ref<'list' | 'detail'>('list')
const reports = ref<TestReport[]>([])
const selectedReport = ref<TestReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const expandedModules = ref<Record<string, boolean>>({})
const isFullscreen = ref(false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      isFullscreen.value = false
    } else {
      close()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})

// Load available reports
async function loadReportList() {
  loading.value = true
  loadError.value = ''
  const files = ['v1.3.0.json']
  const loaded: TestReport[] = []
  for (const f of files) {
    try {
      const resp = await fetch(`/test-reports/${f}`)
      if (resp.ok) {
        const data: TestReport = await resp.json()
        loaded.push(data)
      }
    } catch {
      // skip unavailable reports
    }
  }
  reports.value = loaded.sort((a, b) => {
    const va = a.version.split('.').map(Number)
    const vb = b.version.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if ((va[i] || 0) !== (vb[i] || 0)) return (vb[i] || 0) - (va[i] || 0)
    }
    return 0
  })
  loading.value = false
  if (loaded.length === 0) {
    loadError.value = '暂无测试报告'
  }
}

// Open a report
function openReport(report: TestReport) {
  selectedReport.value = report
  expandedModules.value = {}
  view.value = 'detail'
}

function backToList() {
  view.value = 'list'
  selectedReport.value = null
}

function close() {
  emit('close')
  // Reset after animation
  setTimeout(() => {
    view.value = 'list'
    selectedReport.value = null
  }, 200)
}

function toggleModule(id: string) {
  expandedModules.value[id] = !expandedModules.value[id]
}

function statusBadge(status: string) {
  switch (status) {
    case 'pass': return { cls: 'badge-pass', text: 'PASS' }
    case 'fail': return { cls: 'badge-fail', text: 'FAIL' }
    case 'check': return { cls: 'badge-check', text: 'CHECK' }
    default: return { cls: '', text: status }
  }
}

function priorityClass(p: string) {
  return 'pri-' + p.toLowerCase()
}

function severityClass(s: string) {
  return 'sev-' + s.toLowerCase()
}

// Count stats per module
function getModuleCaseCounts(module: Module): { total: number; pass: number; fail: number; check: number } {
  const result = { total: 0, pass: 0, fail: 0, check: 0 }
  if (module.cases) {
    for (const c of module.cases) {
      result.total++
      if (c.status === 'pass') result.pass++
      else if (c.status === 'fail') result.fail++
      else result.check++
    }
  }
  if (module.subModules) {
    for (const sm of module.subModules) {
      for (const c of sm.cases) {
        result.total++
        if (c.status === 'pass') result.pass++
        else if (c.status === 'fail') result.fail++
        else result.check++
      }
    }
  }
  return result
}

// Load on visible
watch(() => props.visible, (v) => {
  if (v && reports.value.length === 0) {
    loadReportList()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="trm-overlay" @click.self="isFullscreen ? null : close()">
        <div class="trm-modal" :class="{ fullscreen: isFullscreen }">
          <!-- Header -->
          <div class="trm-header">
            <div class="trm-header-left">
              <button v-if="view === 'detail'" class="trm-back-btn" @click="backToList" title="返回列表">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h2 class="trm-title">
                {{ view === 'list' ? '测试报告' : `v${selectedReport?.version} 测试报告` }}
              </h2>
            </div>
            <div class="trm-header-right">
              <button class="trm-fs-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏查看'">
                <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 8 4 3 9 3"/><polyline points="20 16 20 21 15 21"/><line x1="4" y1="3" x2="10" y2="9"/><line x1="20" y1="21" x2="14" y2="15"/>
                </svg>
              </button>
              <button class="trm-close-btn" @click="close" title="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="trm-body">
            <!-- Loading -->
            <div v-if="loading" class="trm-loading">加载中...</div>
            <div v-else-if="loadError && view === 'list'" class="trm-empty">{{ loadError }}</div>

            <!-- List View -->
            <template v-else-if="view === 'list'">
              <div class="trm-list-intro">
                以下各版本对应的完整测试报告，点击版本可查看详细结果。
              </div>
              <div
                v-for="r in reports"
                :key="r.version"
                class="trm-version-card"
                @click="openReport(r)"
              >
                <div class="trm-vc-header">
                  <span class="trm-vc-version">v{{ r.version }}</span>
                  <span class="trm-vc-date">{{ r.testDate }}</span>
                </div>
                <div class="trm-vc-stats">
                  <div class="trm-vc-stat pass">
                    <span class="trm-vc-num">{{ r.summary.passed }}</span>
                    <span class="trm-vc-label">通过</span>
                  </div>
                  <div class="trm-vc-stat fail">
                    <span class="trm-vc-num">{{ r.summary.failed }}</span>
                    <span class="trm-vc-label">失败</span>
                  </div>
                  <div class="trm-vc-stat check">
                    <span class="trm-vc-num">{{ r.summary.manualCheck }}</span>
                    <span class="trm-vc-label">待验证</span>
                  </div>
                  <div class="trm-vc-stat">
                    <span class="trm-vc-num">{{ r.summary.total }}</span>
                    <span class="trm-vc-label">总计</span>
                  </div>
                </div>
                <div class="trm-vc-footer">
                  <span>通过率 {{ r.summary.autoPassRate }}</span>
                  <span>P0: {{ r.summary.p0Passed }}/{{ r.summary.p0Total }}</span>
                  <span v-if="r.summary.foundBugs > 0">Bug: {{ r.summary.foundBugs }}</span>
                </div>
              </div>
            </template>

            <!-- Detail View -->
            <template v-else-if="view === 'detail' && selectedReport">
              <!-- Summary cards -->
              <div class="trm-summary-row">
                <div class="trm-summary-card pass">
                  <div class="trm-sc-num">{{ selectedReport.summary.passed }}</div>
                  <div class="trm-sc-label">通过</div>
                </div>
                <div class="trm-summary-card fail">
                  <div class="trm-sc-num">{{ selectedReport.summary.failed }}</div>
                  <div class="trm-sc-label">失败</div>
                </div>
                <div class="trm-summary-card check">
                  <div class="trm-sc-num">{{ selectedReport.summary.manualCheck }}</div>
                  <div class="trm-sc-label">待验证</div>
                </div>
                <div class="trm-summary-card">
                  <div class="trm-sc-num">{{ selectedReport.summary.total }}</div>
                  <div class="trm-sc-label">总计</div>
                </div>
                <div class="trm-summary-card pass">
                  <div class="trm-sc-num">{{ selectedReport.summary.autoPassRate }}</div>
                  <div class="trm-sc-label">自动化通过率</div>
                </div>
              </div>

              <div class="trm-meta">
                {{ selectedReport.testDate }} · {{ selectedReport.testEnv }} · 测试账号 {{ selectedReport.testAccount }}
              </div>

              <!-- P0 / Bug quick stats -->
              <div class="trm-quick-stats">
                <span class="trm-qs-item" :class="selectedReport.summary.p0Passed === selectedReport.summary.p0Total ? 'ok' : 'warn'">
                  P0: {{ selectedReport.summary.p0Passed }}/{{ selectedReport.summary.p0Total }}
                </span>
                <span class="trm-qs-item" :class="selectedReport.summary.foundBugs > 0 ? 'warn' : 'ok'">
                  Bug: {{ selectedReport.summary.foundBugs }}
                </span>
              </div>

              <!-- Modules -->
              <div class="trm-section-title">模块测试结果</div>
              <div
                v-for="mod in selectedReport.modules"
                :key="mod.id"
                class="trm-module"
              >
                <div class="trm-module-header" @click="toggleModule(mod.id)">
                  <svg
                    class="trm-chevron"
                    :class="{ expanded: expandedModules[mod.id] }"
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span class="trm-module-name">{{ mod.name }}</span>
                  <span class="trm-module-rate" :class="mod.passRate === '100%' ? 'ok' : 'warn'">{{ mod.passRate }}</span>
                  <span class="trm-module-count">{{ getModuleCaseCounts(mod).total }}项</span>
                </div>

                <div v-if="expandedModules[mod.id]" class="trm-module-body">
                  <!-- Direct cases -->
                  <table v-if="mod.cases && mod.cases.length > 0" class="trm-table">
                    <thead>
                      <tr>
                        <th style="width:48px">#</th>
                        <th>测试项</th>
                        <th style="width:52px">优先级</th>
                        <th style="width:64px">结果</th>
                        <th style="width:64px">方式</th>
                        <th style="width:160px">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="c in mod.cases" :key="c.id">
                        <td class="trm-td-id">{{ c.id }}</td>
                        <td class="trm-td-name">{{ c.name }}</td>
                        <td><span class="trm-pri" :class="priorityClass(c.priority)">{{ c.priority }}</span></td>
                        <td><span class="trm-badge" :class="statusBadge(c.status).cls">{{ statusBadge(c.status).text }}</span></td>
                        <td class="trm-td-method">{{ c.method }}</td>
                        <td class="trm-td-note">{{ c.note }}</td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Sub-modules -->
                  <template v-if="mod.subModules">
                    <div v-for="sm in mod.subModules" :key="sm.name" class="trm-submodule">
                      <div class="trm-submodule-name">{{ sm.name }}</div>
                      <table class="trm-table">
                        <thead>
                          <tr>
                            <th style="width:48px">#</th>
                            <th>测试项</th>
                            <th style="width:52px">优先级</th>
                            <th style="width:64px">结果</th>
                            <th style="width:64px">方式</th>
                            <th style="width:160px">备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="c in sm.cases" :key="c.id">
                            <td class="trm-td-id">{{ c.id }}</td>
                            <td class="trm-td-name">{{ c.name }}</td>
                            <td><span class="trm-pri" :class="priorityClass(c.priority)">{{ c.priority }}</span></td>
                            <td><span class="trm-badge" :class="statusBadge(c.status).cls">{{ statusBadge(c.status).text }}</span></td>
                            <td class="trm-td-method">{{ c.method }}</td>
                            <td class="trm-td-note">{{ c.note }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Bugs -->
              <div v-if="selectedReport.bugs.length > 0" class="trm-section-title">发现的问题</div>
              <div v-for="bug in selectedReport.bugs" :key="bug.id" class="trm-bug-card">
                <div class="trm-bug-header">
                  <span class="trm-bug-id">{{ bug.id }}</span>
                  <span class="trm-bug-sev" :class="severityClass(bug.severity)">{{ bug.severity }}</span>
                  <span class="trm-bug-title">{{ bug.title }}</span>
                </div>
                <p class="trm-bug-desc">{{ bug.description }}</p>
                <div v-if="bug.reproduce" class="trm-bug-repro">
                  <strong>复现步骤：</strong>{{ bug.reproduce }}
                </div>
              </div>

              <!-- Findings -->
              <div class="trm-section-title">核心发现</div>
              <ol class="trm-findings">
                <li v-for="(f, i) in selectedReport.findings" :key="i">{{ f }}</li>
              </ol>

              <!-- Recommendations -->
              <div class="trm-section-title">建议</div>
              <ol class="trm-recommendations">
                <li v-for="(r, i) in selectedReport.recommendations" :key="i">{{ r }}</li>
              </ol>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.trm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* Modal */
.trm-modal {
  width: min(920px, 94vw);
  max-height: 88vh;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.trm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.trm-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trm-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0;
}

.trm-back-btn {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: all 0.15s;
}

.trm-back-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.trm-close-btn {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  transition: all 0.15s;
}

.trm-close-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.trm-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.trm-fs-btn {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  transition: all 0.15s;
}

.trm-fs-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

/* Fullscreen mode */
.trm-modal.fullscreen {
  width: 100vw !important;
  max-height: 100vh !important;
  height: 100vh;
  border-radius: 0;
}

.trm-modal.fullscreen .trm-body {
  padding: 24px 32px;
}

.trm-modal.fullscreen .trm-summary-row {
  grid-template-columns: repeat(5, 1fr);
}

/* Body */
.trm-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.trm-loading, .trm-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-3);
  font-size: 14px;
}

.trm-list-intro {
  font-size: 13px;
  color: var(--color-text-3);
  margin-bottom: 16px;
}

/* Version list cards */
.trm-version-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.trm-version-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.trm-vc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.trm-vc-version {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.trm-vc-date {
  font-size: 12px;
  color: var(--color-text-4);
}

.trm-vc-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
}

.trm-vc-stat {
  text-align: center;
}

.trm-vc-num {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
}

.trm-vc-stat.pass .trm-vc-num { color: var(--color-success); }
.trm-vc-stat.fail .trm-vc-num { color: var(--color-danger); }
.trm-vc-stat.check .trm-vc-num { color: var(--color-warning); }

.trm-vc-label {
  font-size: 11px;
  color: var(--color-text-3);
}

.trm-vc-footer {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-4);
}

/* Summary cards */
.trm-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.trm-summary-card {
  background: var(--color-bg-3);
  border-radius: 10px;
  padding: 14px 12px;
  text-align: center;
}

.trm-sc-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  line-height: 1.1;
}

.trm-summary-card.pass .trm-sc-num { color: var(--color-success); }
.trm-summary-card.fail .trm-sc-num { color: var(--color-danger); }
.trm-summary-card.check .trm-sc-num { color: var(--color-warning); }

.trm-sc-label {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.trm-meta {
  font-size: 12px;
  color: var(--color-text-4);
  margin-bottom: 12px;
}

.trm-quick-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.trm-qs-item {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
}

.trm-qs-item.ok {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.trm-qs-item.warn {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

/* Section title */
.trm-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--color-primary);
}

/* Module accordion */
.trm-module {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

.trm-module-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--color-bg-3);
  transition: background 0.15s;
  user-select: none;
}

.trm-module-header:hover {
  background: var(--color-bg-4);
}

.trm-chevron {
  color: var(--color-text-4);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.trm-chevron.expanded {
  transform: rotate(90deg);
}

.trm-module-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.trm-module-rate {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: auto;
}

.trm-module-rate.ok {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.trm-module-rate.warn {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.trm-module-count {
  font-size: 12px;
  color: var(--color-text-4);
}

.trm-module-body {
  padding: 12px 14px;
  border-top: 1px solid var(--color-border);
}

/* Sub-module */
.trm-submodule {
  margin-bottom: 12px;
}

.trm-submodule:last-child {
  margin-bottom: 0;
}

.trm-submodule-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 6px;
}

/* Table */
.trm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.trm-table th {
  background: var(--color-bg-3);
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-3);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.trm-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--color-bg-4);
  color: var(--color-text-2);
  vertical-align: top;
}

.trm-table tr:hover td {
  background: var(--color-bg-3);
}

.trm-td-id {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  color: var(--color-text-4);
}

.trm-td-name {
  font-size: 12px;
}

.trm-td-method, .trm-td-note {
  font-size: 11px;
  color: var(--color-text-4);
}

/* Badges */
.trm-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.badge-pass { background: var(--color-success-light); color: var(--color-success-text); }
.badge-fail { background: var(--color-danger-light); color: var(--color-danger-text); }
.badge-check { background: var(--color-warning-light); color: var(--color-warning-text); }

/* Priority */
.trm-pri {
  font-size: 10px;
  font-weight: 700;
}

.pri-p0 { color: var(--color-danger); }
.pri-p1 { color: var(--color-warning); }
.pri-p2 { color: var(--color-text-4); }

/* Bug cards */
.trm-bug-card {
  background: var(--color-danger-light);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0;
}

.trm-bug-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.trm-bug-id {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-danger);
}

.trm-bug-sev {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.sev-p1 { background: var(--color-warning-light); color: var(--color-warning-text); }
.sev-p2 { background: var(--color-bg-4); color: var(--color-text-3); }

.trm-bug-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
}

.trm-bug-desc {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
  margin: 0 0 4px;
}

.trm-bug-repro {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 4px;
}

/* Findings & Recommendations */
.trm-findings, .trm-recommendations {
  font-size: 13px;
  color: var(--color-text-2);
  padding-left: 20px;
  margin: 0;
  line-height: 1.8;
}

.trm-recommendations {
  font-size: 12px;
}

/* Transitions */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .trm-modal,
.modal-fade-leave-active .trm-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .trm-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.modal-fade-leave-to .trm-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

/* Scrollbar */
.trm-body::-webkit-scrollbar {
  width: 6px;
}

.trm-body::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
</style>
