<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Task, TaskPriority, TaskStatus, TodoItem } from '@/types'
import { useTaskStore } from '@/stores/task'
import { formatDuration } from '@/stores/task'
import { useTheme } from '@/composables/useTheme'
import { toLocalDate } from '@/utils/time'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = useTaskStore()
const { isDark, isZuru, isTencent } = useTheme()

const visible = ref(false)
const editingTask = ref<Task | null>(null)
const isNew = ref(false)
const isCopy = ref(false) // 复制模式

// 待办转任务回调
const convertOnCreated = ref<((taskId: string) => void) | null>(null)

// 删除确认
const deleteVisible = ref(false)

// 重新激活确认（已完成 → 待办）
const reactivateVisible = ref(false)

// Form fields
const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const dueDate = ref('')
const startDate = ref('')  // YYYY-MM-DD 开始日期
const status = ref<TaskStatus>('todo')
const startTime = ref('')  // HH:mm 时间节点
const showPreview = ref(false)
const initialDate = ref('') // 外部传入的创建日期

// Textarea ref for toolbar insertions
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Fullscreen editing mode
const isFullscreen = ref(false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

const priorities = computed((): { value: TaskPriority; label: string; color: string; lightBg: string }[] => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return [
    { value: 'high', label: '高', color: d ? '#f87171' : z ? '#CB312D' : t ? '#f87171' : '#ef4444', lightBg: d ? '#2d1516' : z ? '#F9EBEB' : t ? '#EDF1FF' : '#fef2f2' },
    { value: 'medium', label: '中', color: d ? '#60a5fa' : z ? '#999999' : t ? '#0052D9' : '#3b82f6', lightBg: d ? '#162032' : z ? '#F5F5F5' : t ? '#EDF1FF' : '#eff6ff' },
    { value: 'low', label: '低', color: d ? '#4ade80' : z ? '#BFBFBF' : t ? '#00a870' : '#22c55e', lightBg: d ? '#0f2e1c' : z ? '#F5F5F5' : t ? '#E8F8EE' : '#f0fdf4' },
  ]
})

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const statusMap = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  return {
    todo:     { color: d ? '#cbd5e1' : z ? '#666666' : t ? '#666666' : '#475569', bg: d ? '#252730' : z ? '#F5F5F5' : t ? '#F5F5F5' : '#f1f5f9' },
    in_progress: { color: d ? '#fbbf24' : z ? '#AD2A26' : t ? '#0052D9' : '#d97706', bg: d ? '#2d2006' : z ? '#FFF5F5' : t ? '#EDF1FF' : '#fffbeb' },
    done:     { color: d ? '#4ade80' : z ? '#CB312D' : t ? '#00a870' : '#16a34a', bg: d ? '#0f2e1c' : z ? '#F9EBEB' : t ? '#E8F8EE' : '#f0fdf4' },
  } as Record<TaskStatus, { color: string; bg: string }>
})

const titleColor = computed(() => {
  const d = isDark.value, z = isZuru.value, t = isTencent.value
  const map: Record<TaskPriority, string> = {
    high: d ? '#f87171' : z ? '#CB312D' : t ? '#f87171' : '#ef4444',
    medium: d ? '#60a5fa' : z ? '#999999' : t ? '#0052D9' : '#3b82f6',
    low: d ? '#4ade80' : z ? '#BFBFBF' : t ? '#00a870' : '#22c55e',
  }
  return map[priority.value]
})

/** 正在编辑的任务是否属于未来日期（状态锁定为"待办"） */
const isFutureTask = computed(() => {
  if (!editingTask.value) return false
  const today = toLocalDate()
  return editingTask.value.startDate
    ? editingTask.value.startDate > today
    : editingTask.value.createdAt.slice(0, 10) > today
})

/** 状态选择是否被禁用：未来任务 */
const isStatusLocked = computed(() => isFutureTask.value)

/** 格式化时间戳为 YYYY-MM-DD HH:MM */
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

/** 计划开始时间（组合 startDate + startTime，格式 YYYY-MM-DD HH:MM） */
const plannedStartDisplay = computed(() => {
  if (!startDate.value) return null
  const t = startTime.value || '00:00'
  return `${startDate.value} ${t}`
})

const plannedStartValue = computed(() => {
  if (!startDate.value) return ''
  const t = startTime.value || '00:00'
  return `${startDate.value}T${t}`
})

function onPlannedStartChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val) {
    const [date, time] = val.split('T')
    startDate.value = date
    startTime.value = time || '00:00'
  }
}

/** 任务执行耗时（仅已完成任务展示） */
const taskDuration = computed(() => {
  if (!editingTask.value || editingTask.value.status !== 'done') return null
  return formatDuration(editingTask.value)
})

const renderedDesc = computed(() => {
  if (!description.value.trim()) return '<span style="color:var(--color-text-4)">暂无描述</span>'
  const raw = marked.parse(description.value, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw)
})

// ---- Markdown toolbar ----
interface ToolbarAction {
  icon: string
  label: string
  prefix: string
  suffix: string
  block?: boolean
}

const toolbarActions: ToolbarAction[] = [
  { icon: 'bold', label: '粗体', prefix: '**', suffix: '**' },
  { icon: 'italic', label: '斜体', prefix: '*', suffix: '*' },
  { icon: 'heading', label: '标题', prefix: '### ', suffix: '', block: true },
  { icon: 'ul', label: '无序列表', prefix: '- ', suffix: '', block: true },
  { icon: 'ol', label: '有序列表', prefix: '1. ', suffix: '', block: true },
  { icon: 'check', label: '任务列表', prefix: '- [ ] ', suffix: '', block: true },
  { icon: 'code', label: '代码', prefix: '`', suffix: '`' },
  { icon: 'codeblock', label: '代码块', prefix: '```\n', suffix: '\n```', block: true },
  { icon: 'link', label: '链接', prefix: '[', suffix: '](url)' },
  { icon: 'quote', label: '引用', prefix: '> ', suffix: '', block: true },
]

/** 通过 execCommand 插入文本，保留浏览器原生 Ctrl+Z 撤销能力 */
function insertTextViaExec(ta: HTMLTextAreaElement, text: string) {
  ta.focus()
  document.execCommand('insertText', false, text)
}

function insertMarkdown(action: ToolbarAction) {
  const ta = textareaRef.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = description.value.substring(start, end)
  const before = description.value.substring(0, start)

  // For block-level items, ensure we're on a new line
  let insertPrefix = action.prefix
  if (action.block && start > 0 && before[start - 1] !== '\n') {
    insertPrefix = '\n' + action.prefix
  }

  const newText = selected || action.label
  const replacement = insertPrefix + newText + action.suffix

  // Use execCommand so Ctrl+Z can undo
  ta.setSelectionRange(start, end)
  insertTextViaExec(ta, replacement)

  // Restore cursor position
  nextTick(() => {
    const cursorPos = start + insertPrefix.length + newText.length + action.suffix.length
    if (!selected) {
      ta.setSelectionRange(start + insertPrefix.length, cursorPos)
    } else {
      ta.setSelectionRange(cursorPos, cursorPos)
    }
  })
}

function handleTabKey(e: KeyboardEvent) {
  const ta = textareaRef.value
  if (!ta) return

  e.preventDefault()
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const val = description.value

  // Check if selection spans multiple lines
  const selectedText = val.substring(start, end)
  const hasMultipleLines = selectedText.includes('\n')

  if (hasMultipleLines) {
    // Multi-line: indent/dedent all selected lines
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    const lineEnd = val.indexOf('\n', end - 1)
    const actualEnd = lineEnd === -1 ? val.length : lineEnd
    const blockText = val.substring(lineStart, actualEnd)
    const lines = blockText.split('\n')

    if (e.shiftKey) {
      // Shift+Tab: remove up to 2 leading spaces per line
      let removedTotal = 0
      const newLines = lines.map((line, i) => {
        const spacesToRemove = Math.min(2, line.length - line.trimStart().length)
        removedTotal += spacesToRemove
        return line.substring(spacesToRemove)
      })
      const newBlock = newLines.join('\n')
      ta.setSelectionRange(lineStart, actualEnd)
      insertTextViaExec(ta, newBlock)
      nextTick(() => {
        ta.setSelectionRange(lineStart, lineStart + newBlock.length)
      })
    } else {
      // Tab: add 2 spaces at the start of each line
      const newLines = lines.map(line => '  ' + line)
      const newBlock = newLines.join('\n')
      ta.setSelectionRange(lineStart, actualEnd)
      insertTextViaExec(ta, newBlock)
      nextTick(() => {
        ta.setSelectionRange(lineStart, lineStart + newBlock.length)
      })
    }
  } else {
    // Single line or no selection
    const before = val.substring(0, start)
    if (e.shiftKey) {
      // Shift+Tab: remove up to 2 leading spaces on current line
      const lineStart = before.lastIndexOf('\n') + 1
      const linePrefix = before.substring(lineStart)
      const spacesToRemove = Math.min(2, linePrefix.length - linePrefix.trimStart().length)
      if (spacesToRemove > 0) {
        ta.setSelectionRange(lineStart, lineStart + spacesToRemove)
        insertTextViaExec(ta, '')
        nextTick(() => {
          ta.setSelectionRange(start - spacesToRemove, start - spacesToRemove)
        })
      }
    } else {
      // Tab: insert 2 spaces
      ta.setSelectionRange(start, end)
      insertTextViaExec(ta, '  ')
      nextTick(() => {
        ta.setSelectionRange(start + 2, start + 2)
      })
    }
  }
}

// ---- 新建任务草稿 ----
let justSaved = false  // 防止 close() 中重复保存

function getDraftKey() {
  try {
    const sessionRaw = localStorage.getItem('cleannote_session')
    const userId = sessionRaw ? (JSON.parse(sessionRaw).userId ?? '') : ''
    return userId ? `cleannotes_${userId}_task_draft` : 'cleannotes_task_draft'
  } catch { return 'cleannotes_task_draft' }
}

function saveDraft() {
  if (!isNew.value || isCopy.value || justSaved) return
  const hasContent = title.value.trim() || description.value.trim()
  if (!hasContent) {
    clearDraft()
    return
  }
  localStorage.setItem(getDraftKey(), JSON.stringify({
    title: title.value,
    description: description.value,
  }))
}

function clearDraft() {
  localStorage.removeItem(getDraftKey())
}

function loadDraft(): boolean {
  try {
    const raw = localStorage.getItem(getDraftKey())
    if (!raw) return false
    const d = JSON.parse(raw)
    if (!d.title?.trim() && !d.description?.trim()) return false
    title.value = d.title || ''
    description.value = d.description || ''
    return true
  } catch { return false }
}

function openNew(date?: string) {
  const now = new Date()
  isNew.value = true
  isCopy.value = false
  justSaved = false
  editingTask.value = null
  title.value = ''
  description.value = ''
  priority.value = 'medium'
  dueDate.value = date || ''
  startDate.value = date || toLocalDate()
  status.value = 'todo'
  startTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  initialDate.value = date || ''
  showPreview.value = false
  // 尝试恢复上次未保存的草稿
  loadDraft()
  visible.value = true
}

function openEdit(task: Task) {
  isNew.value = false
  isCopy.value = false
  editingTask.value = task
  title.value = task.title
  description.value = task.description
  priority.value = task.priority
  dueDate.value = task.dueDate || ''
  startDate.value = task.startDate || ''
  startTime.value = task.startTime || ''
  initialDate.value = ''
  showPreview.value = false

  // 未来日期的任务状态锁定为"待办"
  const today = toLocalDate()
  const isFuture = task.startDate ? task.startDate > today : task.createdAt.slice(0, 10) > today
  status.value = isFuture ? 'todo' : task.status

  visible.value = true
}

/** 复制任务：用已有任务数据填充表单，但作为新任务保存 */
function openCopy(task: Task, date?: string) {
  isNew.value = true
  isCopy.value = true
  editingTask.value = null
  title.value = task.title
  description.value = task.description
  priority.value = task.priority
  dueDate.value = task.dueDate || ''
  startDate.value = task.startDate || ''
  startTime.value = task.startTime || ''
  status.value = 'todo'
  initialDate.value = date || ''
  showPreview.value = false
  visible.value = true
}

/** 从待办事项创建任务：预填表单并注册转化回调 */
function openFromTodo(todo: TodoItem, onCreated: (taskId: string) => void) {
  isNew.value = true
  isCopy.value = false
  editingTask.value = null
  title.value = todo.title
  description.value = todo.description
  priority.value = 'medium'
  dueDate.value = todo.estimatedEnd || ''
  startDate.value = todo.estimatedStart || toLocalDate()
  status.value = 'todo'
  startTime.value = ''
  initialDate.value = ''
  showPreview.value = false
  convertOnCreated.value = onCreated
  visible.value = true
}

function close() {
  saveDraft()  // 新建任务关闭前保存草稿
  visible.value = false
  editingTask.value = null
  isFullscreen.value = false
  convertOnCreated.value = null
}

function save() {
  if (!title.value.trim()) return

  if (isNew.value) {
    const task = store.addTask({
      title: title.value.trim(),
      description: description.value.trim(),
      priority: priority.value,
      dueDate: dueDate.value || null,
      startDate: startDate.value || null,
      startTime: startTime.value || null,
      createdAt: initialDate.value || undefined,
    })
    justSaved = true  // 防止 close() → saveDraft() 重新写入草稿
    // 待办转任务回调
    if (convertOnCreated.value) {
      convertOnCreated.value(task.id)
      convertOnCreated.value = null
    }
  } else if (editingTask.value) {
    // 未来日期的任务强制状态为"待办"
    const today = toLocalDate()
    const isFuture = editingTask.value.startDate
      ? editingTask.value.startDate > today
      : editingTask.value.createdAt.slice(0, 10) > today

    // 已完成 → 非已完成：需要确认
    if (editingTask.value.status === 'done' && status.value !== 'done') {
      reactivateVisible.value = true
      return
    }

    doSave(isFuture ? 'todo' : status.value)
  }
  clearDraft()
  close()
}

function doSave(finalStatus: TaskStatus) {
  if (!editingTask.value) return
  store.updateTask(editingTask.value.id, {
    title: title.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    dueDate: dueDate.value || null,
    startDate: startDate.value || null,
    startTime: startTime.value || null,
    status: finalStatus,
  })
  justSaved = true
}

function confirmReactivation() {
  reactivateVisible.value = false
  if (!editingTask.value) return
  doSave(status.value)
  clearDraft()
  close()
}

function cancelReactivation() {
  reactivateVisible.value = false
  // 恢复状态为已完成
  if (editingTask.value) {
    status.value = 'done'
  }
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      isFullscreen.value = false
      e.stopPropagation()
    } else {
      close()
    }
  }
}

/** 删除当前编辑的任务（已完成任务不可删除） */
function handleDelete() {
  if (!editingTask.value || editingTask.value.status === 'done') return
  deleteVisible.value = true
}

function confirmDelete() {
  if (editingTask.value) {
    store.deleteTask(editingTask.value.id)
  }
  deleteVisible.value = false
  close()
}

/** 是否可删除：已有任务且非完成状态 */
const canDelete = computed(() => {
  return !isNew.value && editingTask.value && editingTask.value.status !== 'done'
})

// 弹窗打开时聚焦标题输入框（非只读模式）
const titleInputRef = ref<HTMLInputElement | null>(null)
watch(visible, (val) => {
  if (val) {
    nextTick(() => titleInputRef.value?.focus())
  }
})

defineExpose({ openNew, openEdit, openCopy, openFromTodo, close })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick" @keydown="onKeydown">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-row">
            <span v-if="isCopy" class="copy-badge">复制</span>
            <span v-else-if="isNew" class="new-badge">新建</span>
            <span v-else class="edit-badge">编辑</span>
            <h3 class="modal-title" :style="{ color: titleColor }">
              {{ isCopy ? '复制任务' : isNew ? '新建任务' : '编辑任务' }}
            </h3>
          </div>
          <button class="modal-close" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Title -->
          <div class="form-group">
            <label class="field-label">标题</label>
            <input
              ref="titleInputRef"
              v-model="title"
              class="field-input title-input"
              :style="{ borderLeftColor: titleColor }"
              placeholder="输入任务标题..."
            />
          </div>

          <!-- Row 1: 优先级 + 状态 -->
          <div class="form-row form-row-2col">
            <div class="form-group">
              <label class="field-label">优先级</label>
              <div class="priority-btns">
                <button
                  v-for="p in priorities"
                  :key="p.value"
                  :class="['pri-btn', { active: priority === p.value }]"
                  :style="priority === p.value ? { borderColor: p.color, color: p.color, background: p.lightBg } : {}"
                  type="button"
                  @click="priority = p.value"
                >{{ p.label }}</button>
              </div>
            </div>

            <div class="form-group" v-if="!isNew">
              <label class="field-label">状态</label>
              <select v-if="!isStatusLocked" v-model="status" class="field-select">
                <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              <span v-else class="pri-tag" :style="{ background: statusMap[status]?.bg, color: statusMap[status]?.color}">
                {{ statuses.find(s => s.value === status)?.label }}<span v-if="isFutureTask" class="status-lock-hint">（未来日期锁定）</span>
              </span>
            </div>
          </div>

          <!-- Row 2: 计划开始时间 + 截止日期 -->
          <div class="form-row form-row-2col">
            <div class="form-group">
              <label class="field-label">计划开始时间</label>
              <input type="datetime-local" class="field-input" :value="plannedStartValue" @change="onPlannedStartChange" />
            </div>

            <div class="form-group">
              <label class="field-label">截止日期</label>
              <input v-model="dueDate" type="date" class="field-input" />
            </div>
          </div>

          <!-- Description with Markdown -->
          <div class="form-group desc-group">
            <div class="desc-header">
              <label class="field-label">描述 <span class="md-hint">支持 Markdown</span></label>
              <div class="desc-tabs">
                <button :class="['tab-btn', { active: !showPreview }]" @click="showPreview = false">编辑</button>
                <button :class="['tab-btn', { active: showPreview }]" @click="showPreview = true">预览</button>
              </div>
            </div>
            <!-- Markdown editor container (toolbar + textarea) -->
            <div v-if="!showPreview" class="md-editor-container" :class="{ 'md-fullscreen': isFullscreen }">
              <div class="md-toolbar">
                <div class="tb-group">
                  <button
                    v-for="action in toolbarActions"
                    :key="action.icon"
                    class="tb-btn"
                    :title="action.label"
                    type="button"
                    @click="insertMarkdown(action)"
                  >
                    <!-- Bold -->
                    <svg v-if="action.icon === 'bold'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                    <!-- Italic -->
                    <svg v-else-if="action.icon === 'italic'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                    <!-- Heading -->
                    <svg v-else-if="action.icon === 'heading'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/></svg>
                    <!-- Unordered list -->
                    <svg v-else-if="action.icon === 'ul'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                    <!-- Ordered list -->
                    <svg v-else-if="action.icon === 'ol'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="2" y="14" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="2" y="20" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>
                    <!-- Checkbox -->
                    <svg v-else-if="action.icon === 'check'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                    <!-- Inline code -->
                    <svg v-else-if="action.icon === 'code'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    <!-- Code block -->
                    <svg v-else-if="action.icon === 'codeblock'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="8 10 6 12 8 14"/><polyline points="16 10 18 12 16 14"/><line x1="13" y1="8" x2="11" y2="16"/></svg>
                    <!-- Link -->
                    <svg v-else-if="action.icon === 'link'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <!-- Quote -->
                    <svg v-else-if="action.icon === 'quote'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
                  </button>
                </div>
                <div class="tb-group tb-group-end">
                  <button class="tb-btn" :title="isFullscreen ? '退出全屏 (Esc)' : '全屏编辑'" type="button" @click="toggleFullscreen">
                    <!-- Maximize -->
                    <svg v-if="!isFullscreen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    <!-- Minimize -->
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  </button>
                </div>
              </div>
              <textarea
                ref="textareaRef"
                v-model="description"
                class="field-textarea md-editor"
                placeholder="输入 Markdown 格式的任务描述..."
                rows="8"
                @keydown.tab="handleTabKey"
              ></textarea>
            </div>
            <div class="md-preview" v-html="renderedDesc"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="canDelete" class="btn-delete" @click="handleDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除
          </button>
          <span class="footer-spacer" />
          <button class="btn-cancel" @click="close">取消</button>
          <button class="btn-save" @click="save">
            {{ isNew ? '创建' : '保存' }}
          </button>
        </div>

        <!-- 重新激活确认 -->
        <ConfirmDialog
          :visible="reactivateVisible"
          title="重新激活任务"
          :message="`将已完成任务「<strong>${editingTask?.title}</strong>」重新激活为待办？<br/>激活后将保留历史耗时记录，重新开始执行时会刷新计时。`"
          confirm-text="确认激活"
          type="warning"
          @confirm="confirmReactivation"
          @cancel="cancelReactivation"
        />

        <!-- 删除确认 -->
        <ConfirmDialog
          :visible="deleteVisible"
          title="确认删除"
          :message="`确定要删除任务「<strong>${editingTask?.title}</strong>」吗？<br/>删除后将移入回收站，7 天后自动永久删除。`"
          confirm-text="确认删除"
          type="danger"
          @confirm="confirmDelete"
          @cancel="deleteVisible = false"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-dialog {
  width: 600px;
  max-width: 92vw;
  max-height: 88vh;
  background: var(--color-surface);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px var(--color-shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.edit-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-warning-light);
  color: var(--color-warning-text);
  border-radius: 10px;
}

.new-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-info-light);
  color: var(--color-info);
  border-radius: 10px;
}

.copy-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-success-lighter);
  color: var(--color-success-text);
  border-radius: 10px;
}

.modal-close {
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
}

.modal-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-2);
}

.modal-body {
  padding: 18px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.flex-1 {
  flex: 1;
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-3);
  letter-spacing: 0.3px;
}

.md-hint {
  font-weight: 400;
  color: var(--color-text-4);
  font-size: 10px;
}

.field-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-1);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: var(--color-surface);
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.field-input:disabled {
  background: var(--color-bg-3);
  color: var(--color-text-2);
  cursor: default;
}

.title-input {
  font-size: 15px;
  font-weight: 500;
}

.form-row {
  display: grid;
  gap: 16px;
  align-items: start;
}

.form-row-2col {
  grid-template-columns: 1fr 1fr;
}

.priority-btns {
  display: flex;
  gap: 5px;
}

.pri-btn {
  padding: 5px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text-3);
  cursor: pointer;
  transition: all 0.12s;
}

.pri-btn:hover {
  border-color: var(--color-text-4);
}

.readonly-priority {
  display: flex;
  align-items: center;
  height: 30px;
}

.pri-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  height: 30px;
}

.readonly-value {
  font-size: 13px;
  color: var(--color-text-2);
  padding: 8px 0;
}

.duration-value {
  font-weight: 500;
  color: var(--color-accent);
}

.status-lock-hint {
  font-size: 11px;
  color: var(--color-text-4);
  margin-left: 4px;
}

.field-select {
  padding: 5px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-1);
  outline: none;
  background: var(--color-surface);
  cursor: pointer;
  height: 30px;
}

/* Markdown editor / preview */
.desc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.desc-tabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-4);
  border-radius: 6px;
  padding: 2px;
}

.tab-btn {
  padding: 3px 12px;
  border: none;
  background: transparent;
  font-size: 11px;
  color: var(--color-text-3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}

.tab-btn.active {
  background: var(--color-surface);
  color: var(--color-text-2);
  box-shadow: 0 1px 2px var(--color-shadow);
}

/* Markdown toolbar */
.md-toolbar {
  display: flex;
  gap: 1px;
  padding: 4px 6px;
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.tb-group {
  display: flex;
  gap: 1px;
  flex-wrap: wrap;
}

.tb-group-end {
  margin-left: auto;
}

.tb-btn {
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}

.tb-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.tb-btn:active {
  background: var(--color-primary);
  color: var(--color-surface);
}

.field-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 0 0 8px 8px;
  font-size: 13px;
  color: var(--color-text-1);
  outline: none;
  resize: none;
  line-height: 1.7;
  min-height: 120px;
  transition: border-color 0.15s;
  background: var(--color-surface);
}

/* Description group fills remaining space */
.desc-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.desc-group .md-editor-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.desc-group .field-textarea {
  flex: 1;
  min-height: 220px;
}

.field-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

/* Fullscreen editor container */
.md-editor-container {
  position: relative;
}

.md-editor-container.md-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--color-bg-1);
  display: flex;
  flex-direction: column;
}

.md-editor-container.md-fullscreen .md-toolbar {
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  padding: 6px 12px;
  background: var(--color-bg-2);
  box-shadow: 0 1px 3px var(--color-shadow);
}

.md-editor-container.md-fullscreen .field-textarea {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  border: none;
  font-size: 15px;
  line-height: 1.8;
  padding: 24px 48px;
  resize: none;
  width: 100%;
  background: var(--color-bg-1);
}

.md-preview {
  padding: 14px 16px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  min-height: 100px;
  flex: 1;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.75;
  color: var(--color-text-2);
  background: var(--color-surface);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  word-break: break-word;
}

.md-preview.preview-readonly {
  background: var(--color-bg-3);
  border-color: var(--color-border-light);
}

.md-preview :deep(h1) { font-size: 20px; font-weight: 700; margin: 0 0 10px; color: var(--color-text-1); padding-bottom: 6px; border-bottom: 1px solid var(--color-border-light); }
.md-preview :deep(h2) { font-size: 17px; font-weight: 600; margin: 12px 0 8px; color: var(--color-text-1); }
.md-preview :deep(h3) { font-size: 15px; font-weight: 600; margin: 10px 0 6px; color: var(--color-text-1); }
.md-preview :deep(p) { margin: 0 0 10px; }
.md-preview :deep(ul), .md-preview :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.md-preview :deep(li) { margin-bottom: 3px; }
.md-preview :deep(li)::marker { color: var(--color-text-4); }
.md-preview :deep(code) { background: var(--color-code-bg); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--color-code-text); font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace; }
.md-preview :deep(pre) { background: var(--color-pre-bg); color: var(--color-pre-text); padding: 14px; border-radius: 8px; overflow-x: auto; margin: 0 0 10px; line-height: 1.6; }
.md-preview :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 12px; }
.md-preview :deep(blockquote) { border-left: 3px solid var(--color-primary); padding: 4px 0 4px 14px; margin: 0 0 10px; color: var(--color-text-3); background: var(--color-bg-3); border-radius: 0 6px 6px 0; }
.md-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
.md-preview :deep(th), .md-preview :deep(td) { border: 1px solid var(--color-border-light); padding: 6px 12px; text-align: left; }
.md-preview :deep(th) { background: var(--color-bg-3); font-weight: 600; font-size: 13px; }
.md-preview :deep(a) { color: var(--color-primary); text-decoration: none; border-bottom: 1px solid var(--color-primary); }
.md-preview :deep(a:hover) { opacity: 0.8; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--color-border-light); margin: 14px 0; }
.md-preview :deep(img) { max-width: 100%; border-radius: 6px; }
.md-preview :deep(strong) { font-weight: 600; color: var(--color-text-1); }
.md-preview :deep(em) { font-style: italic; }
/* Task list checkbox styling */
.md-preview :deep(input[type="checkbox"]) { margin-right: 6px; accent-color: var(--color-primary); }

.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--color-border-light);
}

.footer-spacer {
  flex: 1;
}

.btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border: 1px solid var(--color-danger);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.btn-cancel {
  padding: 7px 18px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--color-bg-3);
  color: var(--color-text-2);
}

.btn-save {
  padding: 7px 22px;
  border: none;
  border-radius: 8px;
  color: var(--color-surface);
  background: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-save:hover {
  opacity: 0.85;
}
</style>
