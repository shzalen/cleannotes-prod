<script setup lang="ts">
import { useTaskStore } from '@/stores/task'
import type { TaskStatus } from '@/types'

const store = useTaskStore()

const statusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
}

const priorityDots: Record<string, string> = {
  high: 'var(--color-danger, #ef4444)',
  medium: 'var(--color-warning, #f59e0b)',
  low: 'var(--color-success, #22c55e)',
}

function formatDate(iso: string): string {
  return iso.slice(5, 10)
}

function emitStatus(id: string) {
  store.requestToggleStatus(id)
}
</script>

<template>
  <div class="task-list">
    <div
      v-for="task in store.recentTasks"
      :key="task.id"
      :class="['task-item', { done: task.status === 'done' }]"
    >
      <button
        :class="['task-check', { checked: task.status === 'done' }]"
        @click="emitStatus(task.id)"
        :title="statusLabels[task.status]"
      >
        <svg v-if="task.status === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <svg v-else-if="task.status === 'in_progress'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </button>
      <span class="task-dot" :style="{ backgroundColor: priorityDots[task.priority] }" />
      <span class="task-title">{{ task.title }}</span>
      <span v-if="task.dueDate" class="task-due">{{ formatDate(task.dueDate) }}</span>
    </div>
    <div v-if="!store.recentTasks.length" class="task-empty">
      还没有任务，点击左侧「任务」开始创建
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  transition: background 0.12s;
}

.task-item:hover {
  background: var(--color-bg-2, #f8fafc);
}

.task-item.done .task-title {
  text-decoration: line-through;
  color: var(--color-text-3, #94a3b8);
}

.task-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border, #d1d5db);
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--color-surface, #fff);
  transition: all 0.15s;
  padding: 0;
}

.task-check.checked {
  background: var(--color-success, #22c55e);
  border-color: var(--color-success, #22c55e);
}

.task-check:not(.checked):hover {
  border-color: var(--color-primary, #4f6cf7);
}

.task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-title {
  font-size: 13px;
  color: var(--color-text-1, #1e293b);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-due {
  font-size: 11px;
  color: var(--color-text-3, #94a3b8);
  flex-shrink: 0;
}

.task-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-3, #94a3b8);
}
</style>
