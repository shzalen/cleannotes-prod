<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import type { Task } from '@/types'
import TaskCreateSheet from '@/mobile/components/TaskCreateSheet.vue'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)
const editSheet = ref<InstanceType<typeof TaskCreateSheet> | null>(null)

const priorityColorMap = computed(() => ({
  high: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  medium: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
  low: isDark.value ? '#4ade80' : isZuru.value ? '#BFBFBF' : isTencent.value ? '#00a870' : '#22c55e',
}))

const priorityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }

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

function formatDate(d: string | null) {
  if (!d) return '-'
  return d
}

function formatTime(d: string | null) {
  if (!d) return '-'
  return d.slice(0, 16).replace('T', ' ')
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
          <h3 class="detail-title">{{ task.title }}</h3>

          <!-- Status & Priority -->
          <div class="detail-tags">
            <span class="d-tag status" :class="task.status">{{ statusLabel[task.status] }}</span>
            <span class="d-tag pri" :class="task.priority">{{ priorityLabel[task.priority] }}</span>
          </div>

          <!-- Description -->
          <p v-if="task.description" class="detail-desc">{{ task.description }}</p>

          <!-- Meta -->
          <div class="detail-meta">
            <div class="meta-item">
              <span class="meta-label">计划日期</span>
              <span class="meta-value">{{ formatDate(task.startDate) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">开始时间</span>
              <span class="meta-value">{{ task.startTime || '-' }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">截止日期</span>
              <span class="meta-value">{{ formatDate(task.dueDate) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">创建时间</span>
              <span class="meta-value">{{ formatTime(task.createdAt) }}</span>
            </div>
            <div class="meta-item" v-if="task.completedAt">
              <span class="meta-label">完成时间</span>
              <span class="meta-value">{{ formatTime(task.completedAt) }}</span>
            </div>
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
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 12px;
}

.detail-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
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

.detail-desc {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.6;
  margin-bottom: 16px;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--color-bg-1);
  border-radius: 10px;
  margin-bottom: 20px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-label {
  font-size: 13px;
  color: var(--color-text-3);
}

.meta-value {
  font-size: 13px;
  color: var(--color-text-1);
  font-weight: 500;
}

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
