<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Task, TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'

const { isDark, isZuru, isTencent } = useTheme()
const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)

const inProgressAtInput = ref('')
const completedAtInput = ref('')
const statusInput = ref<TaskStatus>('todo')

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const statusMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    todo:        { color: d ? '#cbd5e1' : z ? '#666666' : t ? '#666666' : '#475569', bg: d ? '#252730' : z ? '#F5F5F5' : t ? '#F5F5F5' : '#f1f5f9' },
    in_progress: { color: d ? '#fbbf24' : z ? '#AD2A26' : t ? '#0052D9' : '#d97706', bg: d ? '#2d2006' : z ? '#FFF5F5' : t ? '#EDF1FF' : '#fffbeb' },
    done:        { color: d ? '#4ade80' : z ? '#CB312D' : t ? '#00a870' : '#16a34a', bg: d ? '#0f2e1c' : z ? '#F9EBEB' : t ? '#E8F8EE' : '#f0fdf4' },
  } as Record<TaskStatus, { color: string; bg: string }>
})

/** datetime-local 格式与 ISO 时间戳互转（本地时区语义） */
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

/** 当前本地时间的 datetime-local 字符串 */
function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 切换状态时自动补全对应时间字段（若尚未填写） */
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

const nextStatusMap: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

function open(t: Task) {
  task.value = t
  // 回填现有实际时间
  inProgressAtInput.value = toDatetimeLocal(t.inProgressAt)
  completedAtInput.value = toDatetimeLocal(t.completedAt)
  statusInput.value = t.status
  // 默认推进到下一状态，并按状态自动补全实际时间（实际开始时间默认当前时间）
  onStatusChange(nextStatusMap[t.status])
  visible.value = true
}

function close() {
  visible.value = false
  task.value = null
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('progress-overlay')) close()
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

  // 已完成 → 非完成：走重新激活确认流程
  if (originalStatus === 'done' && newStatus !== 'done') {
    store.reactivateConfirm.taskId = task.value.id
    store.reactivateConfirm.taskTitle = task.value.title
    store.reactivateConfirm.extraPatch = patch as any
    store.reactivateConfirm.visible = true
    close()
    return
  }

  store.updateTask(task.value.id, patch as any)
  close()
}

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="progress-overlay" @click="handleOverlayClick">
      <div class="progress-dialog">
        <div class="pm-header">
          <div class="pm-title-row">
            <span class="pm-badge">更新进度</span>
            <h3 class="pm-title">{{ task?.title }}</h3>
          </div>
          <button class="pm-close" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="pm-body">
          <!-- 状态选择 -->
          <div class="pm-group">
            <label class="pm-label">状态</label>
            <div class="pm-status-row">
              <button
                v-for="s in statuses"
                :key="s.value"
                type="button"
                class="pm-status-btn"
                :class="{ active: statusInput === s.value }"
                :style="statusInput === s.value ? { background: statusMap[s.value].bg, color: statusMap[s.value].color, borderColor: statusMap[s.value].color } : {}"
                @click="onStatusChange(s.value)"
              >{{ s.label }}</button>
            </div>
          </div>

          <!-- 时间编辑 -->
          <div class="pm-time-grid">
            <div class="pm-group">
              <label class="pm-label">实际开始时间</label>
              <input v-model="inProgressAtInput" type="datetime-local" class="pm-input" />
            </div>
            <div class="pm-group">
              <label class="pm-label">实际完成时间</label>
              <input v-model="completedAtInput" type="datetime-local" class="pm-input" />
            </div>
          </div>
        </div>

        <div class="pm-footer">
          <button class="pm-btn-cancel" @click="close">取消</button>
          <button class="pm-btn-save" @click="save">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.progress-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.progress-dialog {
  width: 460px;
  max-width: 92vw;
  background: var(--color-surface);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px var(--color-shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.pm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--color-border);
}

.pm-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pm-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-bg-4);
  color: var(--color-text-3);
  border-radius: 10px;
  flex-shrink: 0;
}

.pm-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pm-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.pm-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-2);
}

.pm-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pm-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pm-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-3);
  letter-spacing: 0.3px;
}

.pm-status-row {
  display: flex;
  gap: 8px;
}

.pm-status-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.pm-status-btn:hover {
  border-color: var(--color-text-4);
}

.pm-status-btn.active {
  font-weight: 600;
}

.pm-time-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.pm-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text-1);
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}

.pm-input:focus {
  border-color: var(--color-primary);
}

.pm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border-light);
}

.pm-btn-cancel {
  padding: 7px 18px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.pm-btn-cancel:hover {
  background: var(--color-bg-3);
  color: var(--color-text-2);
}

.pm-btn-save {
  padding: 7px 20px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s;
}

.pm-btn-save:hover {
  filter: brightness(0.94);
}
</style>
