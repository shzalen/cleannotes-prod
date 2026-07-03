<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useTaskStore } from '@/stores/task'
import type { TaskPriority } from '@/types'

const store = useTaskStore()
const emit = defineEmits<{ 'create-click': [] }>()

const title = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const description = ref('')
const priority = ref<TaskPriority>('medium')
const dueDate = ref('')
const startTime = ref('')
const showForm = ref(false)

const priorities: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

function submit() {
  if (!title.value.trim()) return
  store.addTask({
    title: title.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    dueDate: dueDate.value || null,
    startTime: startTime.value || null,
  })
  title.value = ''
  description.value = ''
  priority.value = 'medium'
  dueDate.value = ''
  startTime.value = ''
  showForm.value = false
}

// 表单展开时聚焦标题输入框
watch(showForm, (val) => {
  if (val) {
    nextTick(() => titleInputRef.value?.focus())
  }
})

function quickAdd() {
  if (!title.value.trim()) return
  store.addTask({ title: title.value.trim() })
  title.value = ''
}
</script>

<template>
  <div class="task-editor">
    <div class="quick-add">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <input
        ref="titleInputRef"
        v-model="title"
        class="quick-input"
        placeholder="添加任务，回车快速创建..."
        @keydown.enter="quickAdd"
        @keydown.tab.prevent="showForm = true"
      />
      <button v-if="title" class="expand-btn" @click="emit('create-click')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>

    <form v-if="showForm" class="detail-form" @submit.prevent="submit">
      <textarea
        v-model="description"
        class="desc-input"
        placeholder="任务描述（可选）"
        rows="2"
      />
      <div class="form-row">
        <div class="priority-group">
          <span class="form-label">优先级</span>
          <button
            v-for="p in priorities"
            :key="p.value"
            :class="['pri-btn', `pri-${p.value}`, { active: priority === p.value }]"
            type="button"
            @click="priority = p.value"
          >{{ p.label }}</button>
        </div>
        <div class="date-group">
          <span class="form-label">截止日期</span>
          <input v-model="dueDate" type="date" class="date-input" />
        </div>
        <div class="date-group">
          <span class="form-label">时间节点</span>
          <input v-model="startTime" type="time" class="date-input" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="showForm = false">取消</button>
        <button type="submit" class="btn-submit">创建任务</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.task-editor {
  margin-bottom: 16px;
}

.quick-add {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  color: var(--color-text-3, #94a3b8);
  transition: border-color 0.15s;
}

.quick-add:focus-within {
  border-color: var(--color-primary, #4f6cf7);
}

.quick-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--color-text-1, #1e293b);
  background: transparent;
}

.quick-input::placeholder {
  color: var(--color-text-3, #94a3b8);
}

.expand-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-bg-2, #f1f5f9);
  border-radius: 6px;
  color: var(--color-text-3, #94a3b8);
  cursor: pointer;
}

.detail-form {
  margin-top: 8px;
  padding: 16px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desc-input {
  width: 100%;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  outline: none;
  color: var(--color-text-1, #1e293b);
  font-family: inherit;
}

.desc-input:focus {
  border-color: var(--color-primary, #4f6cf7);
}

.form-row {
  display: flex;
  gap: 20px;
  align-items: flex-end;
}

.form-label {
  font-size: 11px;
  color: var(--color-text-3, #94a3b8);
  margin-bottom: 4px;
  display: block;
}

.priority-group {
  display: flex;
  flex-direction: column;
}

.priority-group > div,
.priority-group {
  display: flex;
  gap: 4px;
}

.pri-btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  font-size: 12px;
  background: var(--color-surface, #fff);
  color: var(--color-text-2, #64748b);
  cursor: pointer;
  transition: all 0.12s;
}

.pri-btn.pri-high.active { border-color: var(--color-danger); color: var(--color-danger); background: var(--color-danger-light); }
.pri-btn.pri-medium.active { border-color: var(--color-info); color: var(--color-info); background: var(--color-info-light); }
.pri-btn.pri-low.active { border-color: var(--color-success); color: var(--color-success); background: var(--color-success-lighter); }

.date-group {
  display: flex;
  flex-direction: column;
}

.date-input {
  padding: 4px 8px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  color: var(--color-text-1, #1e293b);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 16px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background: var(--color-surface, #fff);
  color: var(--color-text-2, #64748b);
  font-size: 12px;
  cursor: pointer;
}

.btn-submit {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary, #4f6cf7);
  color: var(--color-white);
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-submit:hover { opacity: 0.9; }
</style>
