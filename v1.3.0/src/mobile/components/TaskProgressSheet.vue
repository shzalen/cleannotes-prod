<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'

const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)

const today = toLocalDate()

const nextStatus = computed(() => {
  if (!task.value) return ''
  if (task.value.status === 'todo') return 'in_progress'
  if (task.value.status === 'in_progress') return 'done'
  return ''
})

const nextLabel = computed(() => {
  if (nextStatus.value === 'in_progress') return '开始进行'
  if (nextStatus.value === 'done') return '标记完成'
  return ''
})

function open(t: Task) {
  task.value = t
  visible.value = true
}

function close() {
  visible.value = false
}

async function advance() {
  if (!task.value || !nextStatus.value) return
  store.updateTask(task.value.id, { status: nextStatus.value as 'in_progress' | 'done' })
  visible.value = false
}

function isFuture(t: Task) {
  if (t.startDate) return t.startDate > today
  return t.createdAt.slice(0, 10) > today
}

defineExpose({ open })
</script>

<template>
  <teleport to="body">
    <div v-if="visible && task" class="sheet-overlay" @click.self="close">
      <div class="sheet-panel">
        <div class="sheet-handle" />
        <div class="sheet-content">
          <h3 class="progress-title">{{ task.title }}</h3>

          <div class="progress-flow">
            <div class="flow-step" :class="{ active: task.status === 'todo', done: task.status !== 'todo' }">
              <div class="flow-dot" />
              <span>待办</span>
            </div>
            <div class="flow-line" :class="{ filled: task.status !== 'todo' }" />
            <div class="flow-step" :class="{ active: task.status === 'in_progress', done: task.status === 'done' }">
              <div class="flow-dot" />
              <span>进行中</span>
            </div>
            <div class="flow-line" :class="{ filled: task.status === 'done' }" />
            <div class="flow-step" :class="{ active: task.status === 'done' }">
              <div class="flow-dot" />
              <span>已完成</span>
            </div>
          </div>

          <div v-if="nextStatus && !isFuture(task)" class="sheet-actions">
            <button class="sheet-btn cancel" @click="close">取消</button>
            <button class="sheet-btn confirm" @click="advance">{{ nextLabel }}</button>
          </div>
          <div v-else class="sheet-actions">
            <button class="sheet-btn cancel" style="flex:1" @click="close">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.sheet-content {
  padding: 8px 20px 24px;
}

.progress-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 24px;
  text-align: center;
}

.progress-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-4);
}

.flow-step.active {
  color: var(--color-primary);
  font-weight: 600;
}

.flow-step.done {
  color: var(--color-primary);
}

.flow-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: var(--color-bg-0);
}

.flow-step.active .flow-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.flow-step.done .flow-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.flow-line {
  width: 40px;
  height: 2px;
  background: var(--color-border);
  margin: 0 4px;
  margin-bottom: 18px;
}

.flow-line.filled {
  background: var(--color-primary);
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
