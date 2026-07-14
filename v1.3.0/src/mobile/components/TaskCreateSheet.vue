<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'

const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)
const title = ref('')
const description = ref('')
const startDate = ref('')
const priority = ref<'low' | 'medium' | 'high'>('medium')
const saving = ref(false)

function open(defaultDate?: string) {
  task.value = null
  title.value = ''
  description.value = ''
  startDate.value = defaultDate || toLocalDate()
  priority.value = 'medium'
  visible.value = true
}

function openEdit(t: Task) {
  task.value = t
  title.value = t.title
  description.value = t.description
  startDate.value = t.startDate || ''
  priority.value = t.priority
  visible.value = true
}

async function save() {
  if (!title.value.trim()) return
  saving.value = true
  try {
    if (task.value) {
      store.updateTask(task.value.id, {
        title: title.value.trim(),
        description: description.value.trim(),
        startDate: startDate.value || null,
        priority: priority.value,
      })
    } else {
      store.addTask({
        title: title.value.trim(),
        description: description.value.trim(),
        startDate: startDate.value || null,
        priority: priority.value,
      })
    }
    visible.value = false
  } finally {
    saving.value = false
  }
}

function close() {
  visible.value = false
}

defineExpose({ open, openEdit })
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="sheet-overlay" @click.self="close">
      <div class="sheet-panel">
        <div class="sheet-handle" />
        <div class="sheet-content">
          <h3 class="sheet-title">{{ task ? '编辑任务' : '新增任务' }}</h3>

          <input
            v-model="title"
            class="sheet-input"
            placeholder="任务标题"
            :disabled="saving"
          />

          <textarea
            v-model="description"
            class="sheet-textarea"
            placeholder="任务描述（可选）"
            rows="3"
            :disabled="saving"
          />

          <div class="field-row">
            <label class="field-label">计划日期</label>
            <input
              v-model="startDate"
              type="date"
              class="sheet-input compact"
              :disabled="saving"
            />
          </div>

          <div class="field-row">
            <label class="field-label">优先级</label>
            <div class="pri-group">
              <button
                v-for="p in (['low', 'medium', 'high'] as const)"
                :key="p"
                class="pri-btn"
                :class="[p, { active: priority === p }]"
                :disabled="saving"
                @click="priority = p"
              >{{ { low: '低', medium: '中', high: '高' }[p] }}</button>
            </div>
          </div>

          <div class="sheet-actions">
            <button class="sheet-btn cancel" @click="close">取消</button>
            <button class="sheet-btn confirm" :disabled="!title.trim() || saving" @click="save">
              {{ saving ? '保存中...' : task ? '保存' : '创建' }}
            </button>
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

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 16px;
  text-align: center;
}

.sheet-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 15px;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  outline: none;
  margin-bottom: 12px;
}

.sheet-input:focus {
  border-color: var(--color-primary);
}

.sheet-input.compact {
  width: auto;
  flex: 1;
  margin-bottom: 0;
}

.sheet-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  outline: none;
  resize: none;
  margin-bottom: 12px;
}

.sheet-textarea:focus {
  border-color: var(--color-primary);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.field-label {
  font-size: 14px;
  color: var(--color-text-2);
  flex-shrink: 0;
  width: 64px;
}

.pri-group {
  display: flex;
  gap: 8px;
}

.pri-btn {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-1);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
}

.pri-btn:active {
  opacity: 0.7;
}

.pri-btn.low.active {
  border-color: var(--color-primary);
  background: var(--color-success-lighter);
  color: var(--color-primary);
}

.pri-btn.medium.active {
  border-color: var(--color-info);
  background: var(--color-info-light);
  color: var(--color-info);
}

.pri-btn.high.active {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.sheet-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
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

.sheet-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
