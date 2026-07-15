<script setup lang="ts">
/**
 * 移动端完整任务创建/编辑弹窗 — 占页面 75-80% 高度
 * 参考 PC 端 TaskEditModal.vue 的字段
 */
import { ref, reactive, computed, nextTick, watch } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task, TaskPriority } from '@/types'
import { showToast } from 'vant'

defineOptions({ name: 'MobileTaskEditPopup' })

const taskStore = useTaskStore()

const visible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const defaultDate = ref('')

const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const startDate = ref('')
const startTime = ref('')
const dueDate = ref('')
const status = ref<'todo' | 'in_progress' | 'done'>('todo')
const saving = ref(false)

const isToday = computed(() => {
  return startDate.value === '' || startDate.value === toLocalDate()
})

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]

const statusOptions = [
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'done' },
]

function openNew(date?: string) {
  resetForm()
  isEditing.value = false
  editingId.value = null
  startDate.value = date || toLocalDate()
  defaultDate.value = date || ''
  visible.value = true
}

function openEdit(task: Task) {
  resetForm()
  isEditing.value = true
  editingId.value = task.id
  title.value = task.title
  description.value = task.description || ''
  priority.value = task.priority
  startDate.value = task.startDate || ''
  startTime.value = task.startTime || ''
  dueDate.value = task.dueDate || ''
  status.value = task.status
  defaultDate.value = ''
  visible.value = true
}

function resetForm() {
  title.value = ''
  description.value = ''
  priority.value = 'medium'
  startDate.value = ''
  startTime.value = ''
  dueDate.value = ''
  status.value = 'todo'
}

function close() {
  visible.value = false
}

async function save() {
  const t = title.value.trim()
  if (!t) {
    showToast('请输入任务标题')
    return
  }

  saving.value = true
  try {
    if (isEditing.value && editingId.value) {
      taskStore.updateTask(editingId.value, {
        title: t,
        description: description.value.trim(),
        priority: priority.value,
        startDate: startDate.value || null,
        startTime: startTime.value || null,
        dueDate: dueDate.value || null,
        status: status.value,
      })
    } else {
      taskStore.addTask({
        title: t,
        description: description.value.trim(),
        priority: priority.value,
        startDate: startDate.value || null,
        startTime: startTime.value || null,
        dueDate: dueDate.value || null,
      })
    }
    showToast(isEditing.value ? '已保存' : '已创建')
    close()
  } catch (e) {
    showToast('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

defineExpose({ openNew, openEdit, close })
</script>

<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    teleport="body"
    :style="{ height: '75%', '--van-popup-background': 'var(--color-surface)' }"
  >
    <div class="edit-popup">
      <!-- 头部 -->
      <div class="edit-popup__header">
        <span class="edit-popup__title">{{ isEditing ? '编辑任务' : '创建任务' }}</span>
        <button class="edit-popup__close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="edit-popup__body">
        <!-- 标题 -->
        <div class="ep-section">
          <label class="ep-label">标题</label>
          <input
            v-model="title"
            class="ep-input"
            placeholder="输入任务标题"
            autofocus
          />
        </div>

        <!-- 描述 -->
        <div class="ep-section">
          <label class="ep-label">描述（支持 Markdown）</label>
          <textarea
            v-model="description"
            class="ep-textarea"
            placeholder="输入任务描述..."
            rows="4"
          ></textarea>
        </div>

        <!-- 优先级 -->
        <div class="ep-section">
          <label class="ep-label">优先级</label>
          <div class="ep-radio-row">
            <button
              v-for="opt in priorityOptions"
              :key="opt.value"
              type="button"
              class="ep-radio-btn"
              :class="{ active: priority === opt.value }"
              @click="priority = opt.value as TaskPriority"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- 日期/时间 -->
        <div class="ep-section">
          <label class="ep-label">日期</label>
          <input
            v-model="startDate"
            type="date"
            class="ep-input"
          />
        </div>
        <div class="ep-section">
          <label class="ep-label">时间</label>
          <input
            v-model="startTime"
            type="time"
            class="ep-input"
          />
        </div>
        <div class="ep-section">
          <label class="ep-label">截止日期</label>
          <input
            v-model="dueDate"
            type="date"
            class="ep-input"
          />
        </div>

        <!-- 状态（仅编辑时显示） -->
        <div v-if="isEditing" class="ep-section">
          <label class="ep-label">状态</label>
          <div class="ep-radio-row">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              type="button"
              class="ep-radio-btn"
              :class="{ active: status === opt.value }"
              @click="status = opt.value as 'todo' | 'in_progress' | 'done'"
            >{{ opt.label }}</button>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="edit-popup__footer">
        <van-button plain round @click="close">取消</van-button>
        <van-button type="primary" round :loading="saving" @click="save">
          {{ isEditing ? '保存' : '创建' }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.edit-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.edit-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.edit-popup__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.edit-popup__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
}
.edit-popup__close svg { width: 20px; height: 20px; }

.edit-popup__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ep-section {
  padding: 0 16px;
}

.ep-label {
  display: block;
  font-size: 17px;
  font-weight: 500;
  color: var(--color-text-2);
  margin-bottom: 8px;
}

.ep-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 17px;
  color: var(--color-text-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}
.ep-input:focus { border-color: var(--color-primary); }
.ep-input::placeholder { color: var(--color-text-3); }

.ep-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 17px;
  color: var(--color-text-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  box-sizing: border-box;
}
.ep-textarea:focus { border-color: var(--color-primary); }
.ep-textarea::placeholder { color: var(--color-text-3); }

.ep-radio-row {
  display: flex;
  gap: 8px;
}

.ep-radio-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 17px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.ep-radio-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.edit-popup__footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}
.edit-popup__footer .van-button { flex: 1; }
</style>
