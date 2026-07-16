<script setup lang="ts">
/**
 * 移动端任务进度更新弹窗 — 长按任务项时弹出
 * 参考 PC 端 TaskProgressModal.vue
 * 使用 iOS 风格日期时间选择器
 */
import { ref } from 'vue'
import type { Task, TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/task'
import { showConfirmDialog } from 'vant'
import MobileIOSPicker from './MobileIOSPicker.vue'

defineOptions({ name: 'MobileTaskProgressPopup' })

const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)
const statusInput = ref<TaskStatus>('todo')
const inProgressAtInput = ref('')
const completedAtInput = ref('')
const saving = ref(false)
const saved = ref(false)

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

async function save() {
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

  // 保存动效：saving → saved ✓ → 短暂延迟 → 关闭
  saving.value = true

  // 本地状态立即更新
  store.updateTask(task.value.id, patch as any)

  // 短暂延迟让"保存中"状态可见，然后展示成功
  setTimeout(() => {
    saving.value = false
    saved.value = true
    setTimeout(() => {
      saved.value = false
      close()
    }, 700)
  }, 180)
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

        <!-- 时间编辑 — iOS 风格选择器 -->
        <div class="pp-group">
          <MobileIOSPicker
            v-model="inProgressAtInput"
            type="datetime"
            label="实际开始时间"
            placeholder="选择开始时间"
          />
        </div>
        <div class="pp-group">
          <MobileIOSPicker
            v-model="completedAtInput"
            type="datetime"
            label="实际完成时间"
            placeholder="选择完成时间"
          />
        </div>
      </div>

      <div class="progress-popup__footer">
        <van-button plain round @click="close" :disabled="saving">取消</van-button>
        <van-button type="primary" round @click="save" :loading="saving" :disabled="saving">
          {{ saving ? '保存中' : '保存' }}
        </van-button>
      </div>

      <!-- 保存成功动效 -->
      <Transition name="saved-pop">
        <div v-if="saved" class="progress-popup__saved-overlay" @click.stop>
          <div class="saved-check">
            <svg viewBox="0 0 52 52" class="saved-check__circle">
              <circle cx="26" cy="26" r="23" fill="none" stroke="var(--color-primary)" stroke-width="3" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="saved-check__mark">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </Transition>
    </div>
  </van-popup>
</template>

<style scoped>
.progress-popup {
  position: relative;
  padding-bottom: var(--safe-bottom);
  overflow-x: hidden;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.progress-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
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
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  font-size: 14px;
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
  font-size: 15px;
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

.progress-popup__footer {
  display: flex;
  gap: 10px;
  padding: 10px 16px 16px;
  border-top: 1px solid var(--color-border-light);
}
.progress-popup__footer .van-button { flex: 1; }

/* ── 保存成功动效 ── */
.progress-popup__saved-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-bg-rgb, 255, 255, 255), 0.92);
  z-index: 10;
  border-radius: 16px 16px 0 0;
}

.saved-check {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.saved-check__circle {
  position: absolute;
  width: 72px;
  height: 72px;
  transform: rotate(-90deg);
}

.saved-check__circle circle {
  stroke-dasharray: 145;
  stroke-dashoffset: 145;
  animation: saved-draw-circle 0.4s 0.05s ease-out forwards;
}

.saved-check__mark {
  width: 34px;
  height: 34px;
  opacity: 0;
  transform: scale(0.3);
  animation: saved-pop-mark 0.3s 0.2s ease-out forwards;
}

@keyframes saved-draw-circle {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes saved-pop-mark {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  60% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transition */
.saved-pop-enter-active {
  transition: opacity 0.15s ease;
}
.saved-pop-leave-active {
  transition: opacity 0.2s ease;
}
.saved-pop-enter-from,
.saved-pop-leave-to {
  opacity: 0;
}
</style>
