<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Task, TaskPriority, TaskStatus } from '@/types'
import { formatDuration } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'

const { isDark, isZuru, isTencent } = useTheme()

const visible = ref(false)
const detailTask = ref<Task | null>(null)

const priority = ref<TaskPriority>('medium')
const status = ref<TaskStatus>('todo')
const startDate = ref('')
const startTime = ref('')
const dueDate = ref('')

const priorities = computed((): { value: TaskPriority; label: string; color: string; lightBg: string }[] => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return [
    { value: 'high', label: '高', color: d ? '#f87171' : z ? '#CB312D' : t ? '#f87171' : '#ef4444', lightBg: d ? '#2d1516' : z ? '#F9EBEB' : t ? '#EDF1FF' : '#fef2f2' },
    { value: 'medium', label: '中', color: d ? '#60a5fa' : z ? '#999999' : t ? '#0052D9' : '#3b82f6', lightBg: d ? '#162032' : z ? '#F5F5F5' : t ? '#EDF1FF' : '#eff6ff' },
    { value: 'low', label: '低', color: d ? '#4ade80' : z ? '#BFBFBF' : t ? '#00a870' : '#22c55e', lightBg: d ? '#0f2e1c' : z ? '#F5F5F5' : t ? '#E8F8EE' : '#f0fdf4' },
  ]
})

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const statusMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    todo:     { color: d ? '#cbd5e1' : z ? '#666666' : t ? '#666666' : '#475569', bg: d ? '#252730' : z ? '#F5F5F5' : t ? '#F5F5F5' : '#f1f5f9' },
    in_progress: { color: d ? '#fbbf24' : z ? '#AD2A26' : t ? '#0052D9' : '#d97706', bg: d ? '#2d2006' : z ? '#FFF5F5' : t ? '#EDF1FF' : '#fffbeb' },
    done:     { color: d ? '#4ade80' : z ? '#CB312D' : t ? '#00a870' : '#16a34a', bg: d ? '#0f2e1c' : z ? '#F9EBEB' : t ? '#E8F8EE' : '#f0fdf4' },
  } as Record<TaskStatus, { color: string; bg: string }>
})

const titleColor = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  const map: Record<TaskPriority, string> = {
    high: d ? '#f87171' : z ? '#CB312D' : t ? '#f87171' : '#ef4444',
    medium: d ? '#60a5fa' : z ? '#999999' : t ? '#0052D9' : '#3b82f6',
    low: d ? '#4ade80' : z ? '#BFBFBF' : t ? '#00a870' : '#22c55e',
  }
  return map[priority.value]
})

const isFutureTask = computed(() => {
  if (!detailTask.value) return false
  const today = toLocalDate()
  return detailTask.value.startDate
    ? detailTask.value.startDate > today
    : detailTask.value.createdAt.slice(0, 10) > today
})

/** 格式化时间戳为 YYYY-MM-DD HH:MM */
function fmtTime(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}`
}

const plannedStartDisplay = computed(() => {
  if (!startDate.value) return null
  const t = startTime.value || '00:00'
  return `${startDate.value} ${t}`
})

const taskDuration = computed(() => {
  if (!detailTask.value || detailTask.value.status !== 'done') return null
  return formatDuration(detailTask.value)
})

const renderedDesc = computed(() => {
  if (!detailTask.value?.description?.trim()) return '<span class="desc-empty">暂无描述</span>'
  const raw = marked.parse(detailTask.value.description, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw)
})

const emit = defineEmits<{ (e: 'edit', task: Task): void }>()

function open(task: Task) {
  detailTask.value = task
  priority.value = task.priority
  status.value = task.status
  startDate.value = task.startDate || ''
  startTime.value = task.startTime || ''
  dueDate.value = task.dueDate || ''
  visible.value = true
}

function close() {
  visible.value = false
  detailTask.value = null
}

/** 点击编辑：关闭详情并通知父组件打开编辑界面 */
function handleEdit() {
  const t = detailTask.value
  if (!t) return
  close()
  emit('edit', t)
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick" @keydown="onKeydown">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="readonly-badge">详情</span>
            <h3 class="modal-title" :style="{ color: titleColor }">任务详情</h3>
          </div>
          <button class="modal-close" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Title -->
          <div class="form-group">
            <label class="field-label">标题</label>
            <span class="readonly-title" :style="{ borderLeftColor: titleColor }">{{ detailTask?.title }}</span>
          </div>

          <!-- Row 1: 优先级 + 状态 + 计划开始时间 + 截止日期 -->
          <div class="form-row form-row-4col">
            <div class="form-group">
              <label class="field-label">优先级</label>
              <span class="pri-tag" :style="{ background: priorities.find(p => p.value === priority)?.lightBg, color: priorities.find(p => p.value === priority)?.color }">
                {{ priorities.find(p => p.value === priority)?.label }}
              </span>
            </div>

            <div class="form-group">
              <label class="field-label">状态</label>
              <span class="pri-tag" :style="{ background: statusMap[status]?.bg, color: statusMap[status]?.color}">
                {{ statuses.find(s => s.value === status)?.label }}<span v-if="isFutureTask" class="status-lock-hint">（未来日期锁定）</span>
              </span>
            </div>

            <div class="form-group">
              <label class="field-label">计划开始时间</label>
              <span class="readonly-value">{{ plannedStartDisplay || '未设置' }}</span>
            </div>

            <div class="form-group">
              <label class="field-label">截止日期</label>
              <span class="readonly-value">{{ dueDate || '未设置' }}</span>
            </div>
          </div>

          <!-- Row 2: 创建时间 + 实际开始时间 + 实际结束时间 + 耗时 -->
          <div class="form-row form-row-4col">
            <div class="form-group">
              <label class="field-label">创建时间</label>
              <span class="readonly-value">{{ fmtTime(detailTask?.createdAt) || '—' }}</span>
            </div>

            <div class="form-group">
              <label class="field-label">实际开始时间</label>
              <span class="readonly-value">{{ fmtTime(detailTask?.inProgressAt) || '—' }}</span>
            </div>

            <div class="form-group">
              <label class="field-label">实际结束时间</label>
              <span class="readonly-value">{{ fmtTime(detailTask?.completedAt) || '—' }}</span>
            </div>

            <div class="form-group">
              <label class="field-label">耗时</label>
              <span class="readonly-value duration-value">{{ taskDuration || '—' }}</span>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group desc-group">
            <label class="field-label">描述</label>
            <div class="md-preview" v-html="renderedDesc"></div>
          </div>
        </div>

        <div class="modal-footer">
          <span class="footer-spacer" />
          <button class="btn-cancel" @click="close">关闭</button>
          <button class="btn-edit" @click="handleEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            编辑
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-dialog {
  width: 640px;
  max-width: 92vw;
  max-height: 88vh;
  background: var(--color-surface);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px var(--color-shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.readonly-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-bg-4);
  color: var(--color-text-3);
  border-radius: 10px;
}

.modal-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-2);
}

.modal-body {
  padding: 18px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-3);
  letter-spacing: 0.3px;
}

.form-row {
  display: grid;
  gap: 16px;
  align-items: start;
}

.form-row-4col {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

.readonly-title {
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-1);
  padding: 8px 12px;
  border-left: 3px solid var(--color-border);
  background: var(--color-bg-3);
  border-radius: 0 8px 8px 0;
}

.pri-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  display: inline-block;
  height: 30px;
  line-height: 24px;
}

.status-lock-hint {
  font-size: 11px;
  color: var(--color-text-4);
  margin-left: 4px;
}

.readonly-value {
  font-size: 13px;
  color: var(--color-text-1);
  padding: 8px 0;
  font-weight: 500;
}

.duration-value {
  font-weight: 500;
  color: var(--color-accent);
}

.desc-group {
  flex: 1;
  min-height: 0;
}

.md-preview {
  padding: 14px 16px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  min-height: 80px;
  flex: 1;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.75;
  color: var(--color-text-2);
  background: var(--color-bg-3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  word-break: break-word;
}

.md-preview :deep(.desc-empty) {
  color: var(--color-text-4);
  font-style: italic;
}

.md-preview :deep(h1) { font-size: 20px; font-weight: 700; margin: 0 0 10px; color: var(--color-text-1); padding-bottom: 6px; border-bottom: 1px solid var(--color-border-light); }
.md-preview :deep(h2) { font-size: 17px; font-weight: 600; margin: 12px 0 8px; color: var(--color-text-1); }
.md-preview :deep(h3) { font-size: 15px; font-weight: 600; margin: 10px 0 6px; color: var(--color-text-1); }
.md-preview :deep(p) { margin: 0 0 10px; }
.md-preview :deep(ul), .md-preview :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.md-preview :deep(li) { margin-bottom: 3px; }
.md-preview :deep(li)::marker { color: var(--color-text-4); }
.md-preview :deep(code) { background: var(--color-code-bg); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--color-code-text); font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace; }
.md-preview :deep(pre) { background: var(--color-pre-bg); color: var(--color-pre-text); padding: 14px; border-radius: 8px; overflow-x: auto; margin: 0 0 10px; line-height: 1.6; }
.md-preview :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 12px; }
.md-preview :deep(blockquote) { border-left: 3px solid var(--color-primary); padding: 4px 0 4px 14px; margin: 0 0 10px; color: var(--color-text-3); background: var(--color-bg-3); border-radius: 0 6px 6px 0; }
.md-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
.md-preview :deep(th), .md-preview :deep(td) { border: 1px solid var(--color-border-light); padding: 6px 12px; text-align: left; }
.md-preview :deep(th) { background: var(--color-bg-3); font-weight: 600; font-size: 13px; }
.md-preview :deep(a) { color: var(--color-primary); text-decoration: none; border-bottom: 1px solid var(--color-primary); }
.md-preview :deep(a:hover) { opacity: 0.8; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--color-border-light); margin: 14px 0; }
.md-preview :deep(img) { max-width: 100%; border-radius: 6px; }
.md-preview :deep(strong) { font-weight: 600; color: var(--color-text-1); }
.md-preview :deep(em) { font-style: italic; }
.md-preview :deep(input[type="checkbox"]) { margin-right: 6px; accent-color: var(--color-primary); }

.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--color-border-light);
}

.footer-spacer {
  flex: 1;
}

.btn-cancel {
  padding: 7px 18px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--color-bg-3);
  color: var(--color-text-2);
}

.btn-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s;
}

.btn-edit:hover {
  filter: brightness(0.94);
}
</style>
