<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore, formatDuration } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import TaskCreateSheet from '@/mobile/components/TaskCreateSheet.vue'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)
const editSheet = ref<InstanceType<typeof TaskCreateSheet> | null>(null)

const today = toLocalDate()

const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}))

const priorityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }

const plannedStartDisplay = computed(() => {
  if (!task.value) return null
  if (!task.value.startDate) return null
  return `${task.value.startDate} ${task.value.startTime || '00:00'}`
})

const taskDuration = computed(() => {
  if (!task.value || task.value.status !== 'done') return null
  return formatDuration(task.value)
})

const isFuture = computed(() => {
  if (!task.value) return false
  return task.value.startDate
    ? task.value.startDate > today
    : task.value.createdAt.slice(0, 10) > today
})

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

function open(t: Task) {
  task.value = t
  visible.value = true
}

function close() {
  visible.value = false
}

function openEdit() {
  if (!task.value) return
  visible.value = false
  setTimeout(() => editSheet.value?.openEdit(task.value!), 300)
}

defineExpose({ open })
</script>

<template>
  <teleport to="body">
    <div v-if="visible && task" class="sheet-overlay" @click.self="close">
      <div class="sheet-panel">
        <div class="sheet-handle" />
        <div class="sheet-content">
          <!-- Title -->
          <h3 class="detail-title" :style="{ color: priorityColorMap[task.priority] }">{{ task.title }}</h3>

          <!-- Status & Priority -->
          <div class="detail-tags">
            <span class="d-tag status" :class="task.status">{{ statusLabel[task.status] }}<span v-if="isFuture" class="lock-hint">（未来日期锁定）</span></span>
            <span class="d-tag pri" :class="task.priority">{{ priorityLabel[task.priority] }}</span>
          </div>

          <!-- Meta Grid (PC-style) -->
          <div class="meta-grid">
            <div class="meta-cell">
              <span class="meta-label">计划开始时间</span>
              <span class="meta-value">{{ plannedStartDisplay || '未设置' }}</span>
            </div>
            <div class="meta-cell">
              <span class="meta-label">截止日期</span>
              <span class="meta-value">{{ task.dueDate || '未设置' }}</span>
            </div>
            <div class="meta-cell">
              <span class="meta-label">创建时间</span>
              <span class="meta-value">{{ fmtTime(task.createdAt) || '—' }}</span>
            </div>
            <div class="meta-cell">
              <span class="meta-label">实际开始时间</span>
              <span class="meta-value">{{ fmtTime(task.inProgressAt) || '—' }}</span>
            </div>
            <div class="meta-cell">
              <span class="meta-label">实际结束时间</span>
              <span class="meta-value">{{ fmtTime(task.completedAt) || '—' }}</span>
            </div>
            <div class="meta-cell">
              <span class="meta-label">耗时</span>
              <span class="meta-value duration">{{ taskDuration || '—' }}</span>
            </div>
          </div>

          <!-- Description -->
          <div v-if="task.description" class="desc-section">
            <span class="desc-label">描述</span>
            <p class="desc-text">{{ task.description }}</p>
          </div>
          <div v-else class="desc-section">
            <span class="desc-label">描述</span>
            <p class="desc-empty">暂无描述</p>
          </div>

          <!-- Actions -->
          <div class="sheet-actions">
            <button class="sheet-btn cancel" @click="close">关闭</button>
            <button class="sheet-btn confirm" @click="openEdit">编辑</button>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <TaskCreateSheet ref="editSheet" />
</template>

<style scoped>
.sheet-content {
  padding: 8px 20px 24px;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
  word-break: break-word;
}

.detail-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.d-tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.d-tag.status.todo {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.d-tag.status.in_progress {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.d-tag.status.done {
  background: var(--color-success-lighter);
  color: var(--color-primary);
}

.lock-hint {
  font-size: 10px;
  color: var(--color-text-4);
  margin-left: 2px;
}

.d-tag.pri.high {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.d-tag.pri.medium {
  background: var(--color-info-light);
  color: var(--color-info);
}

.d-tag.pri.low {
  background: var(--color-success-lighter);
  color: var(--color-primary);
}

/* ── Meta Grid ── */
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  padding: 14px;
  background: var(--color-bg-1);
  border-radius: 10px;
  margin-bottom: 16px;
}

.meta-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: var(--color-text-3);
  font-weight: 500;
}

.meta-value {
  font-size: 13px;
  color: var(--color-text-1);
  font-weight: 500;
}

.meta-value.duration {
  color: var(--color-primary);
}

/* ── Description ── */
.desc-section {
  margin-bottom: 20px;
}

.desc-label {
  font-size: 11px;
  color: var(--color-text-3);
  font-weight: 500;
  display: block;
  margin-bottom: 6px;
}

.desc-text {
  font-size: 14px;
  color: var(--color-text-1);
  line-height: 1.6;
  padding: 12px;
  background: var(--color-bg-1);
  border-radius: 8px;
  word-break: break-word;
  white-space: pre-wrap;
}

.desc-empty {
  font-size: 13px;
  color: var(--color-text-4);
  font-style: italic;
  padding: 12px;
  background: var(--color-bg-1);
  border-radius: 8px;
}

/* ── Actions ── */
.sheet-actions {
  display: flex;
  gap: 12px;
}

.sheet-btn {
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.sheet-btn:active {
  opacity: 0.7;
}

.sheet-btn.cancel {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.sheet-btn.confirm {
  background: var(--color-primary);
  color: #fff;
}
</style>
