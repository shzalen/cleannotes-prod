<script setup lang="ts">
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import { useAiStore } from '@/stores/ai'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const store = useAiStore()
const input = ref('')
const chatContainer = ref<HTMLElement | null>(null)
const showScrollBottom = ref(false)

onMounted(async () => {
  await store.load()
  // Scroll to bottom after loading messages
  await nextTick()
  scrollToBottom()
})

// Check if user has scrolled up from the bottom
function onChatScroll() {
  const el = chatContainer.value
  if (!el) return
  // Threshold: if more than 120px away from bottom, show the button
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollBottom.value = distFromBottom > 120
}

function scrollToBottom() {
  const el = chatContainer.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

// Auto-scroll when messages change (only if already near bottom)
// P-13: O(1) watch trigger instead of O(n) map+join on every evaluation
watch(() => {
  const msgs = store.messages
  return msgs.length + (msgs[msgs.length - 1]?.content.length ?? 0)
}, async () => {
  await nextTick()
  const el = chatContainer.value
  if (!el) return
  // Auto-scroll only if user is near the bottom (within 150px)
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distFromBottom < 150 || store.loading) {
    el.scrollTop = el.scrollHeight
  }
})

// Also scroll when loading state changes
watch(() => store.loading, async () => {
  await nextTick()
  if (chatContainer.value && !store.loading) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatDateLabel(timestamp: string): string {
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return '今天'
  if (isYesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// Group messages by date for date separators
const messageGroups = computed(() => {
  const groups: { date: string; label: string; messages: typeof store.messages }[] = []
  let currentDate = ''
  for (const msg of store.messages) {
    const dateStr = new Date(msg.timestamp).toDateString()
    if (dateStr !== currentDate) {
      currentDate = dateStr
      groups.push({
        date: dateStr,
        label: formatDateLabel(msg.timestamp),
        messages: [],
      })
    }
    groups[groups.length - 1].messages.push(msg)
  }
  return groups
})

// Render markdown for assistant messages
function renderMarkdown(content: string): string {
  const html = marked.parse(content, { breaks: true }) as string
  return DOMPurify.sanitize(html)
}

function isErrorContent(content: string): boolean {
  return content.startsWith('请求失败')
}

function isPendingAction(msg: typeof store.messages[0]): boolean {
  return !!(msg.pendingAction && msg.pendingAction.confirmed === null)
}

function isConfirmed(msg: typeof store.messages[0]): boolean {
  return !!(msg.pendingAction && msg.pendingAction.confirmed === true)
}

function isRejected(msg: typeof store.messages[0]): boolean {
  return !!(msg.pendingAction && msg.pendingAction.confirmed === false)
}

/** Check if this message is the last assistant message and currently streaming */
function isStreaming(msg: typeof store.messages[0]): boolean {
  if (!store.loading || msg.role !== 'assistant') return false
  const lastAssistant = [...store.messages].reverse().find(m => m.role === 'assistant')
  return lastAssistant?.id === msg.id
}

function confirmAction(msgId: string) {
  store.confirmAction(msgId)
}

function rejectAction(msgId: string) {
  store.rejectAction(msgId)
}

// Quick tags
const quickTags = [
  { label: '📋 今日任务', prompt: '帮我看看今天的任务，给个优先级建议' },
  { label: '⏰ 已逾期', prompt: '有哪些已逾期的任务？我该怎么处理？' },
  { label: '📊 任务总结', prompt: '总结一下我最近的任务完成情况' },
  { label: '🧩 智能拆解', prompt: '帮我分析当前待办任务，把大任务拆解为小步骤' },
]

function sendQuickTag(prompt: string) {
  if (store.loading) return
  input.value = ''
  store.send(prompt)
}

async function send() {
  if (!input.value.trim() || store.loading) return
  const msg = input.value.trim()
  input.value = ''
  await store.send(msg)
}
</script>

<template>
  <div class="ai-chat">
    <div class="chat-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
      </svg>
      <span>AI 助手</span>
      <button class="clear-btn" @click="store.clearMessages" title="清空对话">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>

    <div ref="chatContainer" class="chat-messages" @scroll="onChatScroll">
      <div v-if="!store.messages.length" class="chat-empty">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
          </svg>
        </div>
        <p class="empty-title">向 AI 助手提问</p>
        <p class="chat-hint">我可以帮你管理任务、分析进度、给出建议</p>
        <div class="quick-tags-empty">
          <button v-for="tag in quickTags" :key="tag.label" class="quick-tag" @click="sendQuickTag(tag.prompt)">
            {{ tag.label }}
          </button>
        </div>
      </div>

      <template v-for="(group, gi) in messageGroups" :key="gi">
        <div class="date-separator">
          <span class="date-label">{{ group.label }}</span>
        </div>
        <div
          v-for="msg in group.messages"
          :key="msg.id"
          :class="['chat-bubble', msg.role, {
            'is-error': msg.role === 'assistant' && isErrorContent(msg.content),
            'is-pending': msg.role === 'assistant' && isPendingAction(msg),
            'is-confirmed': msg.role === 'assistant' && isConfirmed(msg),
            'is-rejected': msg.role === 'assistant' && isRejected(msg),
            'is-streaming': isStreaming(msg),
          }]"
        >
          <div v-if="msg.role === 'assistant'" class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)" />
          <div v-else class="bubble-content">{{ msg.content }}</div>
          <!-- Streaming cursor -->
          <span v-if="isStreaming(msg)" class="streaming-cursor" />
          <div class="bubble-time">{{ formatTime(msg.timestamp) }}</div>

          <!-- Confirmation buttons for pending actions -->
          <div v-if="isPendingAction(msg)" class="confirm-actions">
            <button class="confirm-btn" @click="confirmAction(msg.id)">确认执行</button>
            <button class="reject-btn" @click="rejectAction(msg.id)">取消</button>
          </div>
        </div>
      </template>
    </div>

    <!-- Scroll to bottom button -->
    <transition name="scroll-btn-fade">
      <button v-if="showScrollBottom" class="scroll-bottom-btn" @click="scrollToBottom" title="回到底部">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </transition>

    <div class="chat-input-area">
      <div class="quick-tags-bar" v-if="store.messages.length > 0">
        <button v-for="tag in quickTags" :key="tag.label" class="quick-tag" @click="sendQuickTag(tag.prompt)" :disabled="store.loading">
          {{ tag.label }}
        </button>
      </div>
      <div class="input-row">
        <input
          v-model="input"
          class="chat-input"
          placeholder="输入消息..."
          @keydown.enter="send"
          :disabled="store.loading"
        />
        <button class="send-btn" @click="send" :disabled="store.loading || !input.trim()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  flex-shrink: 0;
}

.clear-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

/* ---- Scroll to bottom button ---- */
.scroll-bottom-btn {
  position: absolute;
  bottom: 80px;
  right: 28px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--color-shadow);
  transition: all 0.2s;
  z-index: 10;
}

.scroll-bottom-btn:hover {
  background: var(--color-bg-2);
  color: var(--color-primary);
  border-color: var(--color-primary-light);
  box-shadow: 0 2px 12px var(--color-shadow-md);
}

.scroll-btn-fade-enter-active,
.scroll-btn-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.scroll-btn-fade-enter-from,
.scroll-btn-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-icon {
  color: var(--color-text-3);
  margin-bottom: 4px;
}

.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-3);
}

.chat-hint {
  font-size: 12px;
  color: var(--color-text-3);
}

/* ---- Quick tags ---- */
.quick-tags-empty {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}

.quick-tags-bar {
  display: flex;
  gap: 6px;
  padding: 6px 0 2px;
  overflow-x: auto;
  flex-shrink: 0;
}

.quick-tags-bar::-webkit-scrollbar {
  display: none;
}

.quick-tag {
  white-space: nowrap;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-2);
  color: var(--color-text-2);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-tag:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.quick-tag:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Date separator ---- */
.date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
}

.date-separator::before,
.date-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border-light);
}

.date-label {
  font-size: 11px;
  color: var(--color-text-3);
  padding: 0 12px;
  white-space: nowrap;
}

/* ---- Chat bubbles ---- */
.chat-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
  position: relative;
}

.chat-bubble.user {
  align-self: flex-end;
  background: var(--color-primary);
  color: var(--color-white);
  border-bottom-right-radius: 4px;
}

.chat-bubble.assistant {
  align-self: flex-start;
  background: var(--color-surface);
  color: var(--color-text-1);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--color-border-light);
}

.chat-bubble.assistant.is-error {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.chat-bubble.assistant.is-error .bubble-content {
  color: var(--color-danger-text);
}

.chat-bubble.assistant.is-pending {
  border-color: var(--color-primary-light);
  background: var(--color-primary-light);
}

.chat-bubble.assistant.is-confirmed {
  border-color: var(--color-success);
  background: var(--color-success-lighter);
}

.chat-bubble.assistant.is-rejected {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}

.bubble-time {
  margin-top: 4px;
  font-size: 10px;
  opacity: 0.45;
}

.chat-bubble.user .bubble-time {
  text-align: right;
  color: rgba(255, 255, 255, 0.7);
}

.chat-bubble.assistant .bubble-time {
  color: var(--color-text-3);
}

/* ---- Streaming cursor ---- */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--color-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursor-blink 0.8s steps(2) infinite;
}

@keyframes cursor-blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

/* ---- Confirm actions ---- */
.confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.confirm-btn,
.reject-btn {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.confirm-btn {
  background: var(--color-primary);
  color: var(--color-white);
}

.confirm-btn:hover {
  background: var(--color-primary);
}

.reject-btn {
  background: var(--color-bg-2);
  color: var(--color-text-2);
  border: 1px solid var(--color-border);
}

.reject-btn:hover {
  background: var(--color-border);
}

/* ---- Markdown body styles ---- */
.markdown-body :deep(p) {
  margin: 0 0 8px;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: var(--color-text-1);
}

.markdown-body :deep(em) {
  font-style: italic;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 20px;
}

.markdown-body :deep(ul) {
  list-style: disc;
}

.markdown-body :deep(ol) {
  list-style: decimal;
}

.markdown-body :deep(li) {
  margin: 2px 0;
  line-height: 1.6;
}

.markdown-body :deep(code) {
  background: var(--color-code-bg);
  color: var(--color-danger);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.markdown-body :deep(pre) {
  background: var(--color-pre-bg);
  color: var(--color-pre-text);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}

.markdown-body :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

.markdown-body :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--color-primary);
  background: var(--color-bg-2);
  border-radius: 0 6px 6px 0;
  color: var(--color-text-2);
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 600;
  color: var(--color-text-1);
}

.markdown-body :deep(h1) { font-size: 16px; }
.markdown-body :deep(h2) { font-size: 15px; }
.markdown-body :deep(h3) { font-size: 14px; }
.markdown-body :deep(h4) { font-size: 13px; }

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 10px 0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
  width: 100%;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--color-border);
  padding: 6px 10px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--color-bg-2);
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

/* ---- Input area ---- */
.chat-input-area {
  display: flex;
  flex-direction: column;
  padding: 8px 20px 12px;
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.input-row {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 9px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  color: var(--color-text-1);
  background: var(--color-surface);
  transition: border-color 0.15s;
}

.chat-input:focus {
  border-color: var(--color-primary);
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  opacity: 0.9;
}
</style>
