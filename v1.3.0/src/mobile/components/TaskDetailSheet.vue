<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore, formatDuration } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { Popup as VanPopup, Button as VanButton, Tag as VanTag } from 'vant'
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

const plannedStart = computed(() => {
  if (!task.value?.startDate) return '未设置'
  return `${task.value.startDate} ${task.value.startTime || '00:00'}`
})

const taskDuration = computed(() => {
  if (!task.value || task.value.status !== 'done') return '—'
  return formatDuration(task.value) || '—'
})

const isFuture = computed(() => {
  if (!task.value) return false
  return task.value.startDate ? task.value.startDate > today : task.value.createdAt.slice(0, 10) > today
})

function fmtTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function open(t: Task) { task.value = t; visible.value = true }

function openEdit() {
  if (!task.value) return
  visible.value = false
  setTimeout(() => editSheet.value?.openEdit(task.value!), 300)
}

defineExpose({ open })
</script>

<template>
  <VanPopup v-model:show="visible" position="bottom" round :style="{ maxHeight: '85%' }">
    <div v-if="task" class="sheet-content">
      <h3 class="detail-title" :style="{ color: priorityColorMap[task.priority] }">{{ task.title }}</h3>

      <div class="detail-tags">
        <VanTag :type="task.status === 'todo' ? 'default' : task.status === 'in_progress' ? 'warning' : 'success'">
          {{ statusLabel[task.status] }}<span v-if="isFuture">（未来锁定）</span>
        </VanTag>
        <VanTag plain :type="task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'primary' : 'success'">
          {{ priorityLabel[task.priority] }}
        </VanTag>
      </div>

      <div class="meta-grid">
        <div class="meta-cell">
          <span class="meta-label">计划开始</span>
          <span class="meta-value">{{ plannedStart }}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">截止日期</span>
          <span class="meta-value">{{ task.dueDate || '未设置' }}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">创建时间</span>
          <span class="meta-value">{{ fmtTime(task.createdAt) }}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">实际开始</span>
          <span class="meta-value">{{ fmtTime(task.inProgressAt) }}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">实际结束</span>
          <span class="meta-value">{{ fmtTime(task.completedAt) }}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">耗时</span>
          <span class="meta-value duration">{{ taskDuration }}</span>
        </div>
      </div>

      <div v-if="task.description" class="desc-section">
        <span class="desc-label">描述</span>
        <p class="desc-text">{{ task.description }}</p>
      </div>

      <div class="sheet-actions">
        <VanButton block @click="visible = false">关闭</VanButton>
        <VanButton type="primary" block @click="openEdit">编辑</VanButton>
      </div>
    </div>
  </VanPopup>

  <TaskCreateSheet ref="editSheet" />
</template>

<style scoped>
.sheet-content { padding: 20px; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }

.detail-title {
  font-size: 18px; font-weight: 700; margin-bottom: 10px; word-break: break-word;
}

.detail-tags { display: flex; gap: 8px; margin-bottom: 18px; }

.meta-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px;
  padding: 14px; background: var(--color-bg-1); border-radius: 10px; margin-bottom: 16px;
}

.meta-cell { display: flex; flex-direction: column; gap: 2px; }

.meta-label { font-size: 11px; color: var(--color-text-3); }
.meta-value { font-size: 13px; color: var(--color-text-1); font-weight: 500; }
.meta-value.duration { color: var(--color-primary); }

.desc-section { margin-bottom: 20px; }
.desc-label { font-size: 11px; color: var(--color-text-3); display: block; margin-bottom: 6px; }
.desc-text {
  font-size: 14px; color: var(--color-text-1); line-height: 1.6;
  padding: 12px; background: var(--color-bg-1); border-radius: 8px;
  white-space: pre-wrap; word-break: break-word;
}

.sheet-actions { display: flex; gap: 12px; }
</style>
