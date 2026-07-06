<script setup lang="ts">
import { ref, watch } from 'vue'
import { getSyncLogs, type SyncLogEntry } from '@/services/syncLog'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const logs = ref<SyncLogEntry[]>([])

function refreshLogs() {
  logs.value = getSyncLogs()
}

watch(() => props.visible, (v) => {
  if (v) refreshLogs()
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

const typeLabels: Record<SyncLogEntry['type'], string> = {
  full_merge: '全量合并',
  incremental: '增量同步',
  dirty_replay: '离线重放',
  error: '同步错误',
}

const statusLabels: Record<SyncLogEntry['status'], string> = {
  success: '成功',
  partial: '部分成功',
  failed: '失败',
}

const statusClass = (s: SyncLogEntry['status']) => `log-status--${s}`

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

/** 统计已同步项，过滤为 0 的项 */
const syncedItems = (log: SyncLogEntry): string[] => {
  const items: string[] = []
  if (log.tasksSynced > 0) items.push(`${log.tasksSynced} 任务`)
  if (log.deletedSynced > 0) items.push(`${log.deletedSynced} 回收站`)
  if (log.memosSynced > 0) items.push(`${log.memosSynced} 备忘录`)
  if (log.todosSynced > 0) items.push(`${log.todosSynced} 待办`)
  if (log.reportsSynced > 0) items.push(`${log.reportsSynced} 周报`)
  return items
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="slm-overlay"
      @click.self="emit('close')"
      @keydown="onKeydown"
    >
      <div class="slm-modal">
        <div class="slm-header">
          <span class="slm-title">同步日志</span>
          <button class="slm-close" @click="emit('close')" title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="slm-body">
          <template v-if="logs.length === 0">
            <div class="slm-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="slm-empty-icon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>暂无同步记录</span>
              <span class="slm-empty-hint">登录后自动同步时产生记录</span>
            </div>
          </template>
          <template v-else>
            <div v-for="log in logs" :key="log.id" class="log-card">
              <div class="log-card-top">
                <span class="log-type">{{ typeLabels[log.type] }}</span>
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-status" :class="statusClass(log.status)">{{ statusLabels[log.status] }}</span>
              </div>
              <div class="log-summary">{{ log.summary }}</div>
              <div v-if="syncedItems(log).length > 0" class="log-items">
                同步: {{ syncedItems(log).join('、') }}
              </div>
              <div v-if="log.errorMsg" class="log-error">{{ log.errorMsg }}</div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(2px);
  animation: slm-overlay-in 0.15s ease-out;
}

@keyframes slm-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slm-modal {
  width: min(480px, 92vw);
  max-height: 70vh;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slm-in 0.2s ease-out;
}

@keyframes slm-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.slm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.slm-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.slm-close {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: background 0.15s, color 0.15s;
}

.slm-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.slm-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.slm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--color-text-3);
  font-size: 13px;
}

.slm-empty-icon {
  color: var(--color-text-4);
  margin-bottom: 4px;
}

.slm-empty-hint {
  font-size: 11px;
  color: var(--color-text-4);
}

.log-card {
  padding: 12px;
  background: var(--color-bg-3);
  border-radius: 10px;
  margin-bottom: 10px;
}

.log-card:last-child {
  margin-bottom: 0;
}

.log-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.log-type {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
}

.log-time {
  font-size: 11px;
  color: var(--color-text-4);
  margin-left: auto;
}

.log-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.log-status--success {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.log-status--partial {
  background: var(--color-warning-light, color-mix(in srgb, var(--color-warning) 15%, transparent));
  color: var(--color-warning-text, var(--color-warning));
}

.log-status--failed {
  background: var(--color-danger-light);
  color: var(--color-danger-text);
}

.log-summary {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
}

.log-items {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 4px;
}

.log-error {
  font-size: 10px;
  color: var(--color-danger-text);
  margin-top: 4px;
  background: var(--color-danger-light);
  padding: 4px 8px;
  border-radius: 6px;
  word-break: break-all;
}
</style>
