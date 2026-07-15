<script setup lang="ts">
/**
 * 移动端任务进度更新弹窗 — 长按任务项时弹出
 * 参考 PC 端 TaskProgressModal.vue
 */
import { ref } from 'vue'
import type { Task, TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/task'
import { showConfirmDialog } from 'vant'

defineOptions({ name: 'MobileTaskProgressPopup' })

const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)
const statusInput = ref<TaskStatus>('todo')
const inProgressAtInput = ref('')
const completedAtInput = ref('')

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const nextStatusMap: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

function onStatusChange(newStatus: TaskStatus) {
  const now = nowLocal()
  if (newStatus === 'in_progress' && !inProgressAtInput.value) {
    inProgressAtInput.value = now
  }
  if (newStatus === 'done') {
    if (!inProgressAtInput.value) inProgressAtInput.value = now
    if (!completedAtInput.value) completedAtInput.value = now
  }
  statusInput.value = newStatus
}

function open(t: Task) {
  task.value = t
  inProgressAtInput.value = toDatetimeLocal(t.inProgressAt)
  completedAtInput.value = toDatetimeLocal(t.completedAt)
  statusInput.value = t.status
  onStatusChange(nextStatusMap[t.status])
  visible.value = true
}

function close() {
  visible.value = false
  task.value = null
}

function save() {
  if (!task.value) return

  const originalStatus = task.value.status
  const newStatus = statusInput.value
  const iptVal = fromDatetimeLocal(inProgressAtInput.value)
  const cptVal = fromDatetimeLocal(completedAtInput.value)

  const patch: Record<string, any> = { status: newStatus }
  if (iptVal) patch.inProgressAt = iptVal
  if (cptVal) patch.completedAt = cptVal

  if (originalStatus === 'done' && newStatus !== 'done') {
    close()
    showConfirmDialog({
      title: '重新激活任务',
      message: `「${task.value.title}」已完成，确定要重新激活吗？`,
      confirmButtonText: '重新激活',
      cancelButtonText: '取消',
    }).then(() => {
      store.updateTask(task.value!.id, patch as any)
    }).catch(() => {})
    return
  }

  store.updateTask(task.value.id, patch as any)
  close()
}

defineExpose({ open, close })
</script>

<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    teleport="body"
    :style="{ '--van-popup-background': 'var(--color-surface)' }"
  >
    <div class="progress-popup" v-if="task">
      <div class="progress-popup__header">
        <span class="progress-popup__badge">更新进度</span>
        <h3 class="progress-popup__title">{{ task.title }}</h3>
        <button class="progress-popup__close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="progress-popup__body">
        <!-- 状态选择 -->
        <div class="pp-group">
          <label class="pp-label">状态</label>
          <div class="pp-status-row">
            <button
              v-for="s in statuses"
              :key="s.value"
              type="button"
              class="pp-status-btn"
              :class="{ active: statusInput === s.value }"
              @click="onStatusChange(s.value)"
            >{{ s.label }}</button>
          </div>
        </div>

        <!-- 时间编辑 -->
        <div class="pp-time-grid">
          <div class="pp-group">
            <label class="pp-label">实际开始时间</label>
            <input v-model="inProgressAtInput" type="datetime-local" class="pp-input" />
          </div>
          <div class="pp-group">
            <label class="pp-label">实际完成时间</label>
            <input v-model="completedAtInput" type="datetime-local" class="pp-input" />
          </div>
        </div>
      </div>

      <div class="progress-popup__footer">
        <van-button plain round @click="close">取消</van-button>
        <van-button type="primary" round @click="save">保存</van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.progress-popup {
  padding-bottom: var(--safe-bottom);
  overflow-x: hidden;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.progress-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.progress-popup__badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-bg-3);
  color: var(--color-text-3);
  border-radius: 10px;
  flex-shrink: 0;
}

.progress-popup__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-popup__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
  flex-shrink: 0;
}
.progress-popup__close svg { width: 20px; height: 20px; }

.progress-popup__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-x: hidden;
  touch-action: pan-y;
  max-width: 100%;
}

.pp-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pp-label {
  font-size: 17px;
  font-weight: 500;
  color: var(--color-text-3);
}

.pp-status-row {
  display: flex;
  gap: 8px;
}

.pp-status-btn {
  flex: 1;
  padding: 10px 0;
  font-size: 17px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.pp-status-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.pp-time-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.pp-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 17px;
  color: var(--color-text-1);
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}
.pp-input:focus { border-color: var(--color-primary); }

.progress-popup__footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--color-border-light);
}
.progress-popup__footer .van-button { flex: 1; }
</style>
