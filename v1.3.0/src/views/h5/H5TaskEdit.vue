<template>
  <div class="h5-page">
    <!-- 顶部导航 -->
    <header class="h5-nav">
      <button class="h5-nav-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="h5-nav-title">{{ isEdit ? '编辑任务' : '新建任务' }}</span>
      <button class="h5-nav-save" @click="onSave" :disabled="saving || !form.title.trim()">
        {{ saving ? '保存中' : '保存' }}
      </button>
    </header>

    <!-- 表单 -->
    <div class="h5-form">
      <!-- 标题 -->
      <div class="h5-form-group">
        <label class="h5-form-label">任务标题</label>
        <input
          v-model="form.title"
          type="text"
          class="h5-form-input"
          placeholder="输入任务标题..."
          maxlength="100"
        />
      </div>

      <!-- 描述 -->
      <div class="h5-form-group">
        <label class="h5-form-label">描述（选填）</label>
        <textarea
          v-model="form.description"
          class="h5-form-textarea"
          placeholder="添加描述..."
          rows="3"
          maxlength="500"
        ></textarea>
      </div>

      <!-- 优先级 -->
      <div class="h5-form-group">
        <label class="h5-form-label">优先级</label>
        <div class="h5-segment">
          <button
            v-for="opt in priorityOptions"
            :key="opt.value"
            class="h5-segment-btn"
            :class="{ active: form.priority === opt.value, [`seg-${opt.value}`]: true }"
            @click="form.priority = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- 状态（仅编辑时） -->
      <div class="h5-form-group" v-if="isEdit">
        <label class="h5-form-label">状态</label>
        <div class="h5-segment">
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            class="h5-segment-btn"
            :class="{ active: form.status === opt.value, [`seg-status-${opt.value}`]: true }"
            @click="onStatusChange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- 开始日期 -->
      <div class="h5-form-group">
        <label class="h5-form-label">开始日期</label>
        <div class="h5-dual-input">
          <input
            v-model="form.startDate"
            type="date"
            class="h5-form-input h5-form-date"
          />
          <input
            v-model="form.startTime"
            type="time"
            class="h5-form-input h5-form-time"
          />
        </div>
      </div>

      <!-- 截止日期 -->
      <div class="h5-form-group">
        <label class="h5-form-label">截止日期</label>
        <input
          v-model="form.dueDate"
          type="date"
          class="h5-form-input"
        />
      </div>

      <!-- 耗时信息（仅已完成时显示） -->
      <div class="h5-form-group" v-if="isEdit && task?.status === 'done' && task?.inProgressAt && task?.completedAt">
        <label class="h5-form-label">执行耗时</label>
        <div class="h5-duration-display">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ formatDuration(task) }}
        </div>
      </div>

      <!-- 时间戳信息 -->
      <div class="h5-timestamps" v-if="isEdit && task">
        <div class="h5-ts-row" v-if="task.createdAt">
          <span class="h5-ts-label">创建于</span>
          <span class="h5-ts-value">{{ formatDateTime(task.createdAt) }}</span>
        </div>
        <div class="h5-ts-row" v-if="task.inProgressAt">
          <span class="h5-ts-label">开始于</span>
          <span class="h5-ts-value">{{ formatDateTime(task.inProgressAt) }}</span>
        </div>
        <div class="h5-ts-row" v-if="task.completedAt">
          <span class="h5-ts-label">完成于</span>
          <span class="h5-ts-value">{{ formatDateTime(task.completedAt) }}</span>
        </div>
      </div>

      <!-- 删除按钮（仅编辑时） -->
      <button
        v-if="isEdit"
        class="h5-delete-btn"
        @click="onDelete"
        :disabled="saving"
      >
        删除任务
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { useH5Data } from '@/composables/useH5Data'
import { h5Confirm } from '@/composables/useH5Dialog'

const router = useRouter()
const route = useRoute()
const { loading, fetchTasks, createTask, updateTaskFields, removeTask } = useH5Data()

const isEdit = computed(() => !!route.params.id)
const task = ref<Task | null>(null)
const saving = ref(false)

const form = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  status: 'todo' as TaskStatus,
  startDate: '' as string,
  startTime: '' as string,
  dueDate: '' as string,
})

const priorityOptions = [
  { label: '低', value: 'low' as const },
  { label: '中', value: 'medium' as const },
  { label: '高', value: 'high' as const },
]

const statusOptions = [
  { label: '待办', value: 'todo' as const },
  { label: '进行中', value: 'in_progress' as const },
  { label: '已完成', value: 'done' as const },
]

function goBack() {
  router.back()
}

function onStatusChange(status: TaskStatus) {
  form.status = status
}

async function onSave() {
  if (!form.title.trim() || saving.value) return
  saving.value = true

  try {
    if (isEdit.value && task.value) {
      const patch: Partial<Task> = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        startDate: form.startDate || null,
        startTime: form.startTime || null,
        dueDate: form.dueDate || null,
      }

      // 处理状态变更的时间戳
      if (form.status !== task.value.status) {
        const now = new Date().toISOString()
        if (form.status === 'in_progress') {
          patch.status = 'in_progress'
          patch.inProgressAt = now
          patch.completedAt = null
        } else if (form.status === 'done') {
          patch.status = 'done'
          patch.completedAt = now
          if (!task.value.inProgressAt) {
            patch.inProgressAt = now
          }
        } else {
          patch.status = 'todo'
          patch.inProgressAt = null
          patch.completedAt = null
        }
      }

      await updateTaskFields(task.value, patch)
    } else {
      await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        startDate: form.startDate || null,
        startTime: form.startTime || null,
        dueDate: form.dueDate || null,
      })
    }
    router.back()
  } catch (e) {
    console.error('save failed', e)
    saving.value = false
  }
}

async function onDelete() {
  if (!task.value || saving.value) return
  const confirmed = await h5Confirm('确定删除此任务？', '删除任务')
  if (!confirmed) return

  saving.value = true
  try {
    await removeTask(task.value.id)
    router.back()
  } catch (e) {
    console.error('delete failed', e)
    saving.value = false
  }
}

function formatDateTime(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuration(t: Task): string {
  if (!t.inProgressAt || !t.completedAt) return '-'
  const ms = new Date(t.completedAt).getTime() - new Date(t.inProgressAt).getTime()
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  if (hr > 0) return `${hr}小时${min % 60}分钟`
  if (min > 0) return `${min}分钟`
  return `${sec}秒`
}

async function loadData() {
  if (!isEdit.value) return

  loading.value = true
  const all = await fetchTasks()
  const found = all.find(t => t.id === route.params.id)
  if (found) {
    task.value = found
    form.title = found.title
    form.description = found.description
    form.priority = found.priority
    form.status = found.status
    form.startDate = found.startDate || ''
    form.startTime = found.startTime || ''
    form.dueDate = found.dueDate || ''
  }
}

onMounted(loadData)
</script>

<style scoped>
.h5-page {
  min-height: 100%;
}

/* 顶部导航 */
.h5-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.h5-nav-back {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.h5-nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.h5-nav-save {
  padding: 6px 16px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-nav-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 表单 */
.h5-form {
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.h5-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.h5-form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  letter-spacing: 0.3px;
}

.h5-form-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-1);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
  -webkit-appearance: none;
  box-sizing: border-box;
}

.h5-form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.h5-form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-1);
  font-size: 15px;
  outline: none;
  resize: none;
  font-family: inherit;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.h5-form-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.h5-dual-input {
  display: flex;
  gap: 10px;
}

.h5-form-date {
  flex: 1;
}

.h5-form-time {
  width: 120px;
  flex-shrink: 0;
}

/* 分段控件 */
.h5-segment {
  display: flex;
  background: var(--color-bg-2);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}

.h5-segment-btn {
  flex: 1;
  padding: 9px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-3);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-segment-btn.active.seg-low {
  background: var(--color-info-light);
  color: var(--color-info-text);
}

.h5-segment-btn.active.seg-medium {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.h5-segment-btn.active.seg-high {
  background: var(--color-danger-light);
  color: var(--color-danger-text);
}

.h5-segment-btn.active.seg-status-todo {
  background: var(--color-bg-1);
  color: var(--color-text-1);
  box-shadow: 0 1px 3px var(--color-shadow);
}

.h5-segment-btn.active.seg-status-in_progress {
  background: var(--color-primary);
  color: #fff;
}

.h5-segment-btn.active.seg-status-done {
  background: var(--color-success);
  color: #fff;
}

/* 耗时显示 */
.h5-duration-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  background: var(--color-success-light);
  border-radius: 10px;
  color: var(--color-success-text);
  font-size: 14px;
  font-weight: 600;
}

/* 时间戳 */
.h5-timestamps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-bg-2);
  border-radius: 10px;
}

.h5-ts-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.h5-ts-label {
  font-size: 12px;
  color: var(--color-text-3);
}

.h5-ts-value {
  font-size: 12px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
}

/* 删除按钮 */
.h5-delete-btn {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--color-danger);
  border-radius: 10px;
  background: var(--color-danger-light);
  color: var(--color-danger-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-delete-btn:active {
  opacity: 0.7;
}

.h5-delete-btn:disabled {
  opacity: 0.4;
}
</style>
