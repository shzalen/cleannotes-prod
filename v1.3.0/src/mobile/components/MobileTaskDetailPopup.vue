<script setup lang="ts">
/**
 * 移动端任务详情弹窗 — 基于 Vant Popup 实现
 * 参考 PC 端 TaskDetailModal.vue 的任务详情内容
 */
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Task } from '@/types'
import { formatDuration } from '@/stores/task'

defineOptions({ name: 'MobileTaskDetailPopup' })

const visible = ref(false)
const detailTask = ref<Task | null>(null)

function fmtTime(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}`
}

const plannedStartDisplay = computed(() => {
  if (!detailTask.value) return null
  if (!detailTask.value.startDate) return null
  const t = detailTask.value.startTime || '00:00'
  return `${detailTask.value.startDate} ${t}`
})

const taskDuration = computed(() => {
  if (!detailTask.value || detailTask.value.status !== 'done') return null
  return formatDuration(detailTask.value)
})

const renderedDesc = computed(() => {
  if (!detailTask.value?.description?.trim()) return '<span style="color:var(--color-text-4);font-style:italic">暂无描述</span>'
  const raw = marked.parse(detailTask.value.description, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw)
})

const priorityMeta: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--color-danger)' },
  medium: { label: '中', color: 'var(--color-warning)' },
  low: { label: '低', color: 'var(--color-success)' },
}

const statusLabels: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
}

function open(task: Task) {
  detailTask.value = task
  visible.value = true
}

function close() {
  visible.value = false
  detailTask.value = null
}

defineExpose({ open, close })
</script>

<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    teleport="body"
    :style="{ height: '75%', '--van-popup-background': 'var(--color-surface)' }"
  >
    <div class="detail-popup" v-if="detailTask">
      <!-- 头部 -->
      <div class="detail-popup__header">
        <span class="detail-popup__badge">任务详情</span>
        <h3 class="detail-popup__title">{{ detailTask.title }}</h3>
        <button class="detail-popup__close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="detail-popup__body">
        <!-- 优先级 + 状态 -->
        <div class="detail-row detail-row--2col">
          <div class="detail-field">
            <label class="detail-field__label">优先级</label>
            <span
              class="detail-field__tag"
              :style="{
                color: priorityMeta[detailTask.priority]?.color,
                background: `color-mix(in srgb, ${priorityMeta[detailTask.priority]?.color} 12%, transparent)`
              }"
            >{{ priorityMeta[detailTask.priority]?.label }}</span>
          </div>
          <div class="detail-field">
            <label class="detail-field__label">状态</label>
            <span class="detail-field__value">{{ statusLabels[detailTask.status] || detailTask.status }}</span>
          </div>
        </div>

        <!-- 计划时间 + 截止日期 -->
        <div class="detail-row detail-row--2col">
          <div class="detail-field">
            <label class="detail-field__label">计划开始时间</label>
            <span class="detail-field__value">{{ plannedStartDisplay || '未设置' }}</span>
          </div>
          <div class="detail-field">
            <label class="detail-field__label">截止日期</label>
            <span class="detail-field__value">{{ detailTask.dueDate || '未设置' }}</span>
          </div>
        </div>

        <!-- 创建时间 + 实际开始 + 实际完成 + 耗时 -->
        <div class="detail-row detail-row--2col">
          <div class="detail-field">
            <label class="detail-field__label">创建时间</label>
            <span class="detail-field__value">{{ fmtTime(detailTask.createdAt) || '—' }}</span>
          </div>
          <div class="detail-field">
            <label class="detail-field__label">实际开始时间</label>
            <span class="detail-field__value">{{ fmtTime(detailTask.inProgressAt) || '—' }}</span>
          </div>
        </div>
        <div class="detail-row detail-row--2col">
          <div class="detail-field">
            <label class="detail-field__label">实际结束时间</label>
            <span class="detail-field__value">{{ fmtTime(detailTask.completedAt) || '—' }}</span>
          </div>
          <div class="detail-field">
            <label class="detail-field__label">耗时</label>
            <span class="detail-field__value detail-field__value--duration">{{ taskDuration || '—' }}</span>
          </div>
        </div>

        <!-- 描述 -->
        <div class="detail-field detail-field--desc">
          <label class="detail-field__label">描述</label>
          <div class="detail-field__desc" v-html="renderedDesc"></div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="detail-popup__footer">
        <van-button plain round @click="close">关闭</van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.detail-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.detail-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.detail-popup__badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-bg-3);
  color: var(--color-text-3);
  border-radius: 10px;
  flex-shrink: 0;
}

.detail-popup__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-popup__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
  flex-shrink: 0;
}
.detail-popup__close svg { width: 20px; height: 20px; }

.detail-popup__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: grid;
  gap: 12px;
}

.detail-row--2col {
  grid-template-columns: 1fr 1fr;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-field--desc {
  flex: 1;
  min-height: 0;
}

.detail-field__label {
  font-size: 17px;
  font-weight: 500;
  color: var(--color-text-3);
}

.detail-field__value {
  font-size: 17px;
  color: var(--color-text-1);
  font-weight: 500;
  padding: 4px 0;
}

.detail-field__value--duration {
  color: var(--color-primary);
}

.detail-field__tag {
  font-size: 15px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 6px;
  display: inline-block;
  width: fit-content;
}

.detail-field__desc {
  padding: 10px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  font-size: 17px;
  line-height: 1.65;
  color: var(--color-text-2);
  background: var(--color-bg-3);
  overflow-y: auto;
  flex: 1;
  min-height: 60px;
  word-break: break-word;
}

.detail-field__desc :deep(h1) { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
.detail-field__desc :deep(h2) { font-size: 15px; font-weight: 600; margin: 10px 0 6px; }
.detail-field__desc :deep(h3) { font-size: 14px; font-weight: 600; margin: 8px 0 4px; }
.detail-field__desc :deep(p) { margin: 0 0 8px; }
.detail-field__desc :deep(ul), .detail-field__desc :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.detail-field__desc :deep(li) { margin-bottom: 2px; }
.detail-field__desc :deep(code) { background: var(--color-code-bg, #f0f0f0); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
.detail-field__desc :deep(pre) { background: var(--color-pre-bg, #f5f5f5); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 0 0 8px; font-size: 12px; }
.detail-field__desc :deep(blockquote) { border-left: 3px solid var(--color-primary); padding: 2px 0 2px 10px; margin: 0 0 8px; color: var(--color-text-3); }
.detail-field__desc :deep(a) { color: var(--color-primary); }
.detail-field__desc :deep(img) { max-width: 100%; border-radius: 4px; }

.detail-popup__footer {
  padding: 12px 16px calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}
</style>
