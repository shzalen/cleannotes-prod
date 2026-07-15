<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { Popup as VanPopup, Field as VanField, Button as VanButton, Toast } from 'vant'

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
  if (!title.value.trim()) { Toast('请输入任务标题'); return }
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
    Toast.success(task.value ? '已保存' : '已创建')
    visible.value = false
  } finally {
    saving.value = false
  }
}

defineExpose({ open, openEdit })
</script>

<template>
  <VanPopup v-model:show="visible" position="bottom" round :style="{ maxHeight: '85%' }">
    <div class="sheet-content">
      <h3 class="sheet-title">{{ task ? '编辑任务' : '新增任务' }}</h3>

      <VanField v-model="title" placeholder="任务标题" class="sheet-field" />

      <VanField v-model="description" type="textarea" placeholder="任务描述（可选）" rows="2" class="sheet-field" />

      <VanField v-model="startDate" type="date" label="计划日期" class="sheet-field" />

      <div class="pri-row">
        <span class="pri-label">优先级</span>
        <div class="pri-group">
          <VanButton
            v-for="p in (['low', 'medium', 'high'] as const)"
            :key="p"
            :type="priority === p ? 'primary' : 'default'"
            size="small"
            @click="priority = p"
          >{{ { low: '低', medium: '中', high: '高' }[p] }}</VanButton>
        </div>
      </div>

      <div class="sheet-actions">
        <VanButton block @click="visible = false">取消</VanButton>
        <VanButton type="primary" block :loading="saving" @click="save">{{ task ? '保存' : '创建' }}</VanButton>
      </div>
    </div>
  </VanPopup>
</template>

<style scoped>
.sheet-content { padding: 20px; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }

.sheet-title {
  font-size: 17px; font-weight: 600; text-align: center;
  color: var(--color-text-1); margin-bottom: 16px;
}

.sheet-field {
  margin-bottom: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.pri-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}

.pri-label { font-size: 14px; color: var(--color-text-2); }

.pri-group { display: flex; gap: 8px; }

.sheet-actions { display: flex; gap: 12px; }
</style>
