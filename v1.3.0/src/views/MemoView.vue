<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue'
import { useMemoStore } from '@/stores/memo'
import type { MemoItem } from '@/types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import RichTextEditorAsync from '@/components/RichTextEditorAsync.vue'
import { htmlToMarkdown, htmlToPlainText } from '@/utils/markdownExport'

const store = useMemoStore()

// ---- Auto-save plumbing ----
const selectedId = ref<string | null>(null)
const isCreating = ref(false)    // 正在新建但尚未持久化的 memo

const editTitle = ref('')
const editContent = ref('')
const editTags = ref<string[]>([])
const editIcon = ref('')
const tagInput = ref('')

// Common emoji choices for page icons
const EMOJI_OPTIONS = ['📝', '📋', '💡', '🔥', '⭐', '📌', '❤️', '🎯', '📅', '🔒', '⚡', '🌱', '📚', '💻', '🏠', '✈️', '🎨', '🎵']

const isDirty = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_DELAY = 800

const selectedMemo = computed<MemoItem | null>(() => {
  if (!selectedId.value || isCreating.value) return null
  return store.getMemoById(selectedId.value) ?? null
})

/** 将当前编辑内容立即持久化 */
function flushAutoSave() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
  if (!isDirty.value) return

  // 新建 → 创建
  if (isCreating.value) {
    const t = editTitle.value.trim()
    const c = editContent.value.trim()
    if (!t && !c) {
      // 空内容，放弃新建
      selectedId.value = null
      isCreating.value = false
      isDirty.value = false
      return
    }
    const memo = store.addMemo({
      title: t || '未命名备忘录',
      content: editContent.value,
      tags: [...editTags.value],
      pinned: false,
      icon: editIcon.value,
    })
    selectedId.value = memo.id
    isCreating.value = false
    isDirty.value = false
    return
  }

  // 编辑已有 → 更新
  if (selectedId.value) {
    store.updateMemo(selectedId.value, {
      title: editTitle.value.trim(),
      content: editContent.value,
      tags: [...editTags.value],
      icon: editIcon.value,
    })
    isDirty.value = false
  }
}

/** schedule debounced auto-save */
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(flushAutoSave, AUTO_SAVE_DELAY)
}

// ---- Editor population ----
watch(selectedId, (id) => {
  if (!id || isCreating.value) {
    // creating state is handled by createNewMemo / handleQuickCapture
    return
  }
  const memo = store.getMemoById(id)
  if (memo) {
    editTitle.value = memo.title
    editContent.value = memo.content
    editTags.value = [...memo.tags]
    editIcon.value = memo.icon || ''
  }
})

// ---- Auto-save lifecycle ----
watch([editTitle, editContent, editTags, editIcon], () => {
  if (!selectedId.value && !isCreating.value) return
  // 新建态下，标题和内容均为空时不触发自动保存（防止刚进入创建就被清退）
  if (isCreating.value && !editTitle.value.trim() && !editContent.value.trim()) return
  isDirty.value = true
  scheduleAutoSave()
}, { deep: true })

// Flush before leaving
onBeforeUnmount(() => {
  flushAutoSave()
  memoIoObserver?.disconnect()
})

// ---- Progressive rendering for memo list ----
const MEMO_DISPLAY_BATCH = 50
const memoDisplayLimit = ref(MEMO_DISPLAY_BATCH)
const memoSentinelRef = ref<HTMLElement | null>(null)
let memoIoObserver: IntersectionObserver | null = null

const normalMemosDisplay = computed(() =>
  store.normalMemos.slice(0, memoDisplayLimit.value),
)

function setupMemoObserver() {
  if (memoIoObserver) memoIoObserver.disconnect()
  memoIoObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        memoDisplayLimit.value += MEMO_DISPLAY_BATCH
      }
    },
    { rootMargin: '200px' },
  )
  if (memoSentinelRef.value) memoIoObserver.observe(memoSentinelRef.value)
}

watch(memoSentinelRef, (el) => {
  if (el) setupMemoObserver()
})

// Reset limit when search/filter changes
watch([() => store.searchQuery, () => store.activeTag], () => {
  memoDisplayLimit.value = MEMO_DISPLAY_BATCH
})

// ---- Actions ----
function selectMemo(id: string) {
  if (isDirty.value) flushAutoSave()
  isCreating.value = false
  selectedId.value = id
}

function createNewMemo() {
  if (isDirty.value) flushAutoSave()
  isCreating.value = true
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
  editTags.value = []
  editIcon.value = ''
  tagInput.value = ''
  // focus title input after render
  nextTick(() => {
    const el = document.querySelector('.editor-title-input') as HTMLInputElement | null
    el?.focus()
  })
}

// ---- Templates ----
interface MemoTemplate {
  title: string
  icon: string
  content: string
}

const TEMPLATES: MemoTemplate[] = [
  { title: '空白备忘录', icon: '📝', content: '' },
  { title: '待办清单', icon: '✅', content: '<ul data-type="taskList"><li><label><input type="checkbox"><span></span></label><div><p>待办事项 1</p></div></li><li><label><input type="checkbox"><span></span></label><div><p>待办事项 2</p></div></li></ul>' },
  { title: '会议纪要', icon: '📋', content: '<h1>会议主题</h1><p>时间：</p><p>参与人：</p><h2>议程</h2><ul><li><p></p></li></ul><h2>决议</h2><ul><li><p></p></li></ul>' },
  { title: '读书笔记', icon: '📚', content: '<h1>书名</h1><blockquote><p>精彩摘录</p></blockquote><p>心得体会：</p>' },
  { title: '项目计划', icon: '🎯', content: '<h1>项目目标</h1><p>背景：</p><h2>里程碑</h2><ul><li><p>里程碑 1</p></li></ul><h2>风险</h2><ul><li><p></p></li></ul>' },
]

const templatePickerVisible = ref(false)
const tagExpandThreshold = 8
const showAllTags = ref(false)

/** 默认只显示前 N 个标签，展开后显示全部 */
const displayedTags = computed(() => {
  if (store.allTags.length <= tagExpandThreshold) return store.allTags
  if (showAllTags.value) return store.allTags
  return store.allTags.slice(0, tagExpandThreshold)
})

function createFromTemplate(tpl: MemoTemplate) {
  if (isDirty.value) flushAutoSave()
  isCreating.value = true
  selectedId.value = null
  editTitle.value = tpl.title
  editContent.value = tpl.content
  editTags.value = []
  editIcon.value = tpl.icon
  tagInput.value = ''
  templatePickerVisible.value = false
  nextTick(() => {
    const el = document.querySelector('.editor-title-input') as HTMLInputElement | null
    el?.focus()
  })
}

function cancelCreate() {
  if (isDirty.value) flushAutoSave()
  isCreating.value = false
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
  editTags.value = []
  editIcon.value = ''
}

// ---- Quick capture ----
const quickTitle = ref('')

function handleQuickCapture() {
  const val = quickTitle.value.trim()
  if (!val) return
  if (isDirty.value) flushAutoSave()
  // 直接创建并选中
  const memo = store.addMemo({ title: val, content: '' })
  quickTitle.value = ''
  isCreating.value = false
  selectedId.value = memo.id
}

function onQuickKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleQuickCapture()
  }
}

// ---- Pin / Delete ----
function handlePin(memo: MemoItem) {
  store.togglePin(memo.id)
}

const deleteConfirmVisible = ref(false)
const deleteTarget = ref<MemoItem | null>(null)

function handleDelete(memo: MemoItem) {
  deleteTarget.value = memo
  deleteConfirmVisible.value = true
}

function confirmDelete() {
  if (!deleteTarget.value) return
  const deletedId = deleteTarget.value.id
  store.removeMemo(deletedId)
  deleteConfirmVisible.value = false
  deleteTarget.value = null
  // 如果正在编辑被删除的 memo，清空右侧
  if (selectedId.value === deletedId) {
    isCreating.value = false
    selectedId.value = null
    editTitle.value = ''
    editContent.value = ''
    editTags.value = []
    editIcon.value = ''
    isDirty.value = false
  }
}

function cancelDelete() {
  deleteConfirmVisible.value = false
  deleteTarget.value = null
}

// ---- Tags ----
function addTag() {
  const val = tagInput.value.trim()
  if (!val) return
  if (editTags.value.includes(val)) return
  editTags.value.push(val)
  tagInput.value = ''
}

function removeTag(tag: string) {
  editTags.value = editTags.value.filter(t => t !== tag)
}

function onTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
}

// ---- Tag filter ----
function setActiveTag(tag: string) {
  store.activeTag = store.activeTag === tag ? '' : tag
}

// ---- Icon ----
const iconPickerVisible = ref(false)

function selectIcon(emoji: string) {
  editIcon.value = emoji
  iconPickerVisible.value = false
}

function clearIcon() {
  editIcon.value = ''
  iconPickerVisible.value = false
}

// Close icon picker when clicking outside
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.icon-picker') && !target.closest('.editor-icon-btn')) {
    iconPickerVisible.value = false
  }
  if (!target.closest('.toc-panel') && !target.closest('.toc-wrap')) {
    tocVisible.value = false
  }
  if (!target.closest('.template-picker') && !target.closest('.btn-template')) {
    templatePickerVisible.value = false
  }
}

// ---- Table of Contents ----
const headings = ref<{ level: number; text: string; index: number }[]>([])
const tocVisible = ref(false)

function onHeadingsChange(list: { level: number; text: string; index: number }[]) {
  headings.value = list
}

function scrollToHeading(index: number) {
  const editorEl = document.querySelector('.rte-editor') as HTMLElement | null
  if (!editorEl) return
  const targets = editorEl.querySelectorAll('h1, h2, h3')
  const target = targets[index] as HTMLElement | undefined
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---- Export ----
const exportMessage = ref('')
let exportMessageTimer: ReturnType<typeof setTimeout> | null = null

function showExportMessage(msg: string) {
  exportMessage.value = msg
  if (exportMessageTimer) clearTimeout(exportMessageTimer)
  exportMessageTimer = setTimeout(() => {
    exportMessage.value = ''
  }, 2000)
}

function exportMarkdown() {
  if (!selectedMemo.value) return
  const md = `# ${selectedMemo.value.title}\n\n${htmlToMarkdown(selectedMemo.value.content)}`
  navigator.clipboard.writeText(md).then(() => {
    showExportMessage('Markdown 已复制到剪贴板')
  }).catch(() => {
    showExportMessage('复制失败')
  })
}

function copyPlainText() {
  if (!selectedMemo.value) return
  const text = `${selectedMemo.value.title}\n\n${htmlToPlainText(selectedMemo.value.content)}`
  navigator.clipboard.writeText(text).then(() => {
    showExportMessage('纯文本已复制到剪贴板')
  }).catch(() => {
    showExportMessage('复制失败')
  })
}

// ---- Image Lightbox ----
const lightboxVisible = ref(false)
const lightboxSrc = ref('')

function openLightbox(src: string) {
  lightboxSrc.value = src
  lightboxVisible.value = true
  document.addEventListener('keydown', onLightboxKeydown)
}

function closeLightbox() {
  lightboxVisible.value = false
  lightboxSrc.value = ''
  document.removeEventListener('keydown', onLightboxKeydown)
}

function onLightboxKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeLightbox()
  }
}

function handleEditorDblClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const src = (target as HTMLImageElement).src
    if (src) openLightbox(src)
  }
}

function onImageLightbox(src: string) {
  openLightbox(src)
}

// ---- Mention navigation ----
function onMentionClick(memoId: string) {
  if (isDirty.value) flushAutoSave()
  const target = store.getMemoById(memoId)
  if (target) {
    isCreating.value = false
    selectedId.value = target.id
  }
}

// ---- Helpers ----
function formatDate(isoStr: string): string {
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 截取纯文本预览 — S-16: regex instead of innerHTML to avoid XSS/DOM overhead */
function plainExcerpt(html: string, maxLen: number): string {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

// ---- Memo stats ----
const memoStats = computed(() => ({
  total: store.memos.length,
  pinned: store.pinnedMemos.length,
}))

// ---- Drag & Drop reorder ----
const dragId = ref<string | null>(null)
const dragPinned = ref(false)
const dragOverId = ref<string | null>(null)
const dragOverAfter = ref(false) // true = place after target, false = before

const canDrag = computed(() => !store.searchQuery.trim() && !store.activeTag)

function onDragStart(e: DragEvent, memo: MemoItem) {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  dragId.value = memo.id
  dragPinned.value = memo.pinned
  e.dataTransfer?.setData('text/plain', memo.id)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, memo: MemoItem) {
  e.preventDefault()
  if (!canDrag.value || !dragId.value || dragPinned.value !== memo.pinned) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  dragOverId.value = memo.id
  dragOverAfter.value = e.clientY > midY
}

function onDragLeave() {
  dragOverId.value = null
}

function onDrop(e: DragEvent, memo: MemoItem) {
  e.preventDefault()
  if (!canDrag.value || !dragId.value || dragPinned.value !== memo.pinned) {
    dragId.value = null
    dragOverId.value = null
    return
  }
  const group = memo.pinned ? store.pinnedMemos : store.normalMemos
  let targetIndex = group.findIndex(m => m.id === memo.id)
  if (targetIndex === -1) return
  if (dragOverAfter.value) targetIndex += 1
  store.reorderMemo(dragId.value, targetIndex)
  dragId.value = null
  dragOverId.value = null
}

function onDragEnd() {
  dragId.value = null
  dragOverId.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault()
    createNewMemo()
  }
}

onMounted(() => {
  store.load()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keydown', onLightboxKeydown)
})
</script>

<template>
  <div class="memo-layout">
    <!-- Skeleton loading -->
    <div v-if="!store.loaded" class="memo-skeleton">
      <aside class="sk-sidebar">
        <div class="sk-sidebar-hd">
          <div class="skeleton-line sk-w-20 sk-h-20"></div>
          <div class="sk-hd-actions">
            <div class="skeleton-line sk-w-12 sk-h-14"></div>
            <div class="skeleton-line sk-w-12 sk-h-14"></div>
          </div>
        </div>
        <div class="sk-search">
          <div class="skeleton-line sk-w-full sk-h-14"></div>
        </div>
        <div v-for="i in 6" :key="'msk'+i" class="sk-memo-item">
          <div class="skeleton-line sk-w-40 sk-h-14" style="margin-bottom:4px"></div>
          <div class="skeleton-line sk-w-28 sk-h-10"></div>
        </div>
      </aside>
      <main class="sk-editor">
        <div class="sk-editor-hd">
          <div class="skeleton-line sk-w-24 sk-h-22"></div>
        </div>
        <div class="sk-editor-body">
          <div class="skeleton-line sk-w-40 sk-h-16" style="margin-bottom:10px"></div>
          <div v-for="i in 8" :key="'mel'+i" class="skeleton-line sk-w-full sk-h-12" style="margin-bottom:6px"></div>
        </div>
      </main>
    </div>

    <!-- Main content -->
    <template v-else>
    <!-- =========== Left Panel =========== -->
    <aside class="memo-sidebar">
      <!-- Header -->
      <div class="sidebar-header">
        <h2 class="sidebar-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          备忘录
        </h2>
        <div class="sidebar-header-actions">
          <button class="btn-new-memo" @click="createNewMemo" title="新建备忘录 (Ctrl+N)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新建
          </button>
          <button class="btn-template" @click.stop="templatePickerVisible = !templatePickerVisible" title="从模板新建">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>
          <div v-if="templatePickerVisible" class="template-picker">
            <div class="template-picker-title">从模板新建</div>
            <button
              v-for="tpl in TEMPLATES"
              :key="tpl.title"
              class="template-picker-item"
              @click="createFromTemplate(tpl)"
            >
              <span class="template-picker-icon">{{ tpl.icon }}</span>
              <span class="template-picker-label">{{ tpl.title }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick capture -->
      <div class="quick-bar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="qb-icon">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <input
          v-model="quickTitle"
          class="qb-input"
          placeholder="快速记录备忘… 回车保存"
          @keydown="onQuickKeydown"
        />
      </div>

      <!-- Search -->
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="store.searchQuery"
          class="search-input"
          placeholder="搜索备忘录…"
        />
      </div>

      <!-- Tag filters -->
      <div v-if="store.allTags.length > 0" class="tag-filters">
        <button
          v-for="tag in displayedTags"
          :key="tag"
          :class="['tag-filter', { active: store.activeTag === tag }]"
          @click="setActiveTag(tag)"
        >{{ tag }}</button>
        <button
          v-if="store.allTags.length > tagExpandThreshold"
          class="tag-filter tag-filter--toggle"
          @click="showAllTags = !showAllTags"
        >
          {{ showAllTags ? '收起' : `+${store.allTags.length - tagExpandThreshold} 更多` }}
        </button>
      </div>

      <!-- Stats -->
      <div class="sidebar-stats" v-if="memoStats.total > 0">
        <span class="stat-item">{{ memoStats.total }} 条备忘</span>
        <span v-if="memoStats.pinned > 0" class="stat-dot">·</span>
        <span v-if="memoStats.pinned > 0" class="stat-item">{{ memoStats.pinned }} 置顶</span>
      </div>

      <!-- Memo list -->
      <div class="memo-list">
        <!-- Empty state -->
        <div v-if="store.pinnedMemos.length === 0 && store.normalMemos.length === 0" class="list-empty">
          <p class="empty-text">暂无备忘录</p>
          <p class="empty-hint">点击「新建」开始记录</p>
        </div>

        <!-- Pinned -->
        <template v-if="store.pinnedMemos.length > 0">
          <div class="list-section-label">置顶</div>
          <div
            v-for="memo in store.pinnedMemos"
            :key="memo.id"
            :class="[
              'memo-list-item',
              { active: selectedId === memo.id },
              { 'is-dragging': dragId === memo.id },
              { 'drag-over': dragOverId === memo.id && !dragOverAfter },
              { 'drag-over-after': dragOverId === memo.id && dragOverAfter },
            ]"
            :draggable="canDrag"
            @click="selectMemo(memo.id)"
            @dragstart="onDragStart($event, memo)"
            @dragover="onDragOver($event, memo)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, memo)"
            @dragend="onDragEnd"
          >
            <div class="mli-main">
              <svg v-if="canDrag" class="mli-drag-handle" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="12" r="1"/>
                <circle cx="9" cy="5" r="1"/>
                <circle cx="9" cy="19" r="1"/>
                <circle cx="15" cy="12" r="1"/>
                <circle cx="15" cy="5" r="1"/>
                <circle cx="15" cy="19" r="1"/>
              </svg>
              <svg class="mli-pin-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <line x1="12" y1="17" x2="12" y2="22"/>
                <path d="M5 17h14v-3l-4-6V4h1V2H8v2h1v5l-4 6v3z"/>
              </svg>
              <span v-if="memo.icon" class="mli-icon">{{ memo.icon }}</span>
              <span class="mli-title">{{ memo.title }}</span>
            </div>
            <div class="mli-meta">
              <span v-if="memo.content" class="mli-excerpt">{{ plainExcerpt(memo.content, 36) }}</span>
              <span v-if="!memo.content" class="mli-excerpt mli-no-content">无内容</span>
              <span class="mli-date">{{ formatDate(memo.updatedAt) }}</span>
            </div>
            <div class="mli-actions">
              <button class="mli-btn" @click.stop="handlePin(memo)" title="取消置顶">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-3l-4-6V4h1V2H8v2h1v5l-4 6v3z"/>
                </svg>
              </button>
              <button class="mli-btn mli-btn-del" @click.stop="handleDelete(memo)" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </template>

        <!-- Normal -->
        <template v-if="store.normalMemos.length > 0">
          <div v-if="store.pinnedMemos.length > 0" class="list-section-label">全部备忘</div>
          <div
            v-for="memo in normalMemosDisplay"
            :key="memo.id"
            :class="[
              'memo-list-item',
              { active: selectedId === memo.id },
              { 'is-dragging': dragId === memo.id },
              { 'drag-over': dragOverId === memo.id && !dragOverAfter },
              { 'drag-over-after': dragOverId === memo.id && dragOverAfter },
            ]"
            :draggable="canDrag"
            @click="selectMemo(memo.id)"
            @dragstart="onDragStart($event, memo)"
            @dragover="onDragOver($event, memo)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, memo)"
            @dragend="onDragEnd"
          >
            <div class="mli-main">
              <svg v-if="canDrag" class="mli-drag-handle" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="12" r="1"/>
                <circle cx="9" cy="5" r="1"/>
                <circle cx="9" cy="19" r="1"/>
                <circle cx="15" cy="12" r="1"/>
                <circle cx="15" cy="5" r="1"/>
                <circle cx="15" cy="19" r="1"/>
              </svg>
              <span v-if="memo.icon" class="mli-icon">{{ memo.icon }}</span>
              <span class="mli-title">{{ memo.title }}</span>
            </div>
            <div class="mli-meta">
              <span v-if="memo.content" class="mli-excerpt">{{ plainExcerpt(memo.content, 36) }}</span>
              <span v-if="!memo.content" class="mli-excerpt mli-no-content">无内容</span>
              <span class="mli-date">{{ formatDate(memo.updatedAt) }}</span>
            </div>
            <div class="mli-actions">
              <button class="mli-btn" @click.stop="handlePin(memo)" title="置顶">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-3l-4-6V4h1V2H8v2h1v5l-4 6v3z"/>
                </svg>
              </button>
              <button class="mli-btn mli-btn-del" @click.stop="handleDelete(memo)" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div v-if="store.normalMemos.length > memoDisplayLimit" ref="memoSentinelRef" class="memo-sentinel"></div>
        </template>
      </div>
    </aside>

    <!-- =========== Right Panel =========== -->
    <main class="memo-editor">
      <!-- Empty state -->
      <div v-if="!isCreating && !selectedId" class="editor-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p class="empty-text">选择左侧备忘录开始编辑</p>
        <p class="empty-hint">或点击「新建」创建一条新备忘录</p>
      </div>

      <!-- Editor -->
      <div v-else class="editor-active">
        <!-- Editor header -->
        <div class="editor-header">
          <!-- Icon picker -->
          <div class="editor-icon-wrap">
            <button
              class="editor-icon-btn"
              :title="editIcon ? '更换图标' : '添加图标'"
              @click.stop="iconPickerVisible = !iconPickerVisible"
            >
              <span v-if="editIcon" class="editor-icon-emoji">{{ editIcon }}</span>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
              </svg>
            </button>
            <div v-if="iconPickerVisible" class="icon-picker">
              <div class="icon-picker-grid">
                <button
                  v-for="emoji in EMOJI_OPTIONS"
                  :key="emoji"
                  class="icon-picker-item"
                  @click="selectIcon(emoji)"
                >{{ emoji }}</button>
              </div>
              <button class="icon-picker-clear" @click="clearIcon">清除图标</button>
            </div>
          </div>

          <!-- Title -->
          <input
            v-model="editTitle"
            class="editor-title-input"
            placeholder="备忘录标题…"
          />

          <!-- Toolbar: delete + status -->
          <div class="editor-header-actions">
            <div class="toc-wrap">
              <button
                v-if="headings.length > 0"
                class="btn-header-action"
                @click.stop="tocVisible = !tocVisible"
                title="目录大纲"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                目录
              </button>
              <div v-if="tocVisible && headings.length > 0" class="toc-panel">
                <div class="toc-title">目录大纲</div>
                <button
                  v-for="h in headings"
                  :key="h.index"
                  class="toc-item"
                  :style="{ paddingLeft: 8 + (h.level - 1) * 12 + 'px' }"
                  @click="scrollToHeading(h.index)"
                >
                  {{ h.text || '无标题' }}
                </button>
              </div>
            </div>
            <span v-if="exportMessage" class="editor-status editor-status--message">{{ exportMessage }}</span>
            <span v-else-if="selectedMemo" class="editor-status">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              自动保存
            </span>
            <button v-if="selectedMemo" class="btn-header-action" @click="exportMarkdown" title="复制 Markdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              MD
            </button>
            <button v-if="selectedMemo" class="btn-header-action" @click="copyPlainText" title="复制纯文本">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button v-if="isCreating" class="btn-cancel-create" @click="cancelCreate">放弃</button>
            <button v-if="selectedMemo" class="btn-delete-memo" @click="handleDelete(selectedMemo)" title="删除此备忘录">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Content editor -->
        <div class="editor-content" @dblclick="handleEditorDblClick">
          <RichTextEditorAsync
            v-model="editContent"
            placeholder="在这里撰写备忘录内容… 输入 / 打开命令面板，支持 Markdown 语法"
            @mention-click="onMentionClick"
            @headings-change="onHeadingsChange"
            @image-lightbox="onImageLightbox"
          />
        </div>

        <!-- Tags area -->
        <div class="editor-footer">
          <div class="tag-area">
            <div class="tag-list">
              <span v-for="tag in editTags" :key="tag" class="tag-chip">
                {{ tag }}
                <button class="tag-remove" @click="removeTag(tag)">&times;</button>
              </span>
            </div>
            <input
              v-model="tagInput"
              class="tag-input"
              placeholder="添加标签… 回车确认"
              @keydown="onTagKeydown"
            />
          </div>

          <div class="editor-meta" v-if="selectedMemo">
            <span class="meta-text">创建于 {{ formatDate(selectedMemo.createdAt) }}</span>
            <span class="meta-text">更新于 {{ formatDate(selectedMemo.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Delete Confirm -->
    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="删除备忘"
      :message="deleteTarget ? `确定要删除「<strong>${deleteTarget.title}</strong>」吗？此操作不可恢复。` : ''"
      confirm-text="删除"
      type="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Image Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxVisible"
        class="memo-lightbox-overlay"
        @click.self="closeLightbox"
      >
        <button class="lightbox-close" @click="closeLightbox" title="关闭">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <img :src="lightboxSrc" class="lightbox-image" @click.stop />
      </div>
    </Teleport>
    </template>
  </div>
</template>

<script lang="ts">
export default { name: 'MemoView' }
</script>

<style scoped>
/* ====== Layout ====== */
.memo-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
}

/* ====== Left Sidebar ====== */
.memo-sidebar {
  width: 300px;
  min-width: 260px;
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-2);
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.sidebar-title svg {
  color: var(--color-text-3);
}

.btn-new-memo {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-success-light);
  background: var(--color-success-lighter);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-success-text);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.btn-new-memo:hover {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.btn-template {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-template:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.template-picker {
  position: absolute;
  top: 34px;
  right: 0;
  width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  padding: 8px;
  z-index: 100;
}

.template-picker-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-4);
  padding: 4px 8px 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.12s;
}

.template-picker-item:hover {
  background: var(--color-bg-3);
  color: var(--color-primary);
}

.template-picker-icon {
  font-size: 14px;
}

.template-picker-label {
  flex: 1;
  text-align: left;
}

/* Quick capture */
.quick-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 8px;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  transition: border-color 0.15s;
  flex-shrink: 0;
}

.quick-bar:focus-within {
  border-color: var(--color-primary);
  border-style: solid;
}

.qb-icon {
  color: var(--color-text-4);
  flex-shrink: 0;
}

.qb-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--color-text-1);
  background: transparent;
}

.qb-input::placeholder {
  color: var(--color-text-4);
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 8px;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  transition: border-color 0.15s;
  flex-shrink: 0;
}

.search-box:focus-within {
  border-color: var(--color-primary);
}

.search-icon {
  color: var(--color-text-4);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--color-text-1);
  background: transparent;
}

.search-input::placeholder {
  color: var(--color-text-4);
}

/* Tag filters */
.tag-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 12px 8px;
  flex-shrink: 0;
}

.tag-filter {
  padding: 2px 8px;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  line-height: 1.5;
}

.tag-filter--toggle {
  border-style: dashed;
  color: var(--color-text-4);
  background: transparent;
}

.tag-filter--toggle:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.tag-filter:hover {
  border-color: var(--color-info);
  color: var(--color-info);
}

.tag-filter.active {
  background: var(--color-info-light);
  border-color: var(--color-info);
  color: var(--color-info-text, var(--color-info));
}

/* Stats */
.sidebar-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 16px 8px;
  font-size: 10px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.stat-dot {
  color: var(--color-text-4);
}

/* Memo list */
.memo-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.list-empty {
  text-align: center;
  padding: 32px 12px;
}

.memo-sentinel {
  height: 1px;
  width: 100%;
}

.empty-text {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-3);
}

.empty-hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-4);
}

.list-section-label {
  padding: 6px 8px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* List item */
.memo-list-item {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}

.memo-list-item:hover {
  background: var(--color-bg-4);
}

.memo-list-item.active {
  background: var(--color-primary-bg, var(--color-info-light));
}

.memo-list-item:hover .mli-actions {
  opacity: 1;
}

.mli-main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mli-drag-handle {
  color: var(--color-text-4);
  flex-shrink: 0;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.12s;
}

.memo-list-item:hover .mli-drag-handle {
  opacity: 1;
}

.memo-list-item.is-dragging {
  opacity: 0.5;
}

.memo-list-item.drag-over {
  border-top: 2px solid var(--color-primary);
}

.memo-list-item.drag-over-after {
  border-bottom: 2px solid var(--color-primary);
}

.mli-pin-icon {
  color: var(--color-warning, #f0a020);
  flex-shrink: 0;
  margin-top: 1px;
}

.mli-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.memo-list-item.active .mli-title {
  color: var(--color-primary);
}

.mli-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  padding-left: 0;
}

.memo-list-item:has(.mli-pin-icon) .mli-meta {
  padding-left: 14px;
}

.mli-excerpt {
  font-size: 11px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.mli-no-content {
  font-style: italic;
  color: var(--color-text-4);
}

.mli-date {
  font-size: 10px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.mli-actions {
  position: absolute;
  top: 6px;
  right: 8px;
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.12s;
}

.mli-btn {
  width: 24px;
  height: 22px;
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

.mli-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-warning, #f0a020);
}

.mli-btn-del:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* ====== Right Editor ====== */
.memo-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

/* Empty state */
.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-3);
}

.empty-icon {
  color: var(--color-text-4);
  opacity: 0.4;
}

.editor-empty .empty-text {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.editor-empty .empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-4);
}

/* Active editor */
.editor-active {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px 0;
  flex-shrink: 0;
}

.editor-title-input {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-1);
  outline: none;
  background: transparent;
  transition: border-color 0.2s;
}

.editor-title-input:focus {
  border-bottom-color: var(--color-primary);
}

.editor-title-input::placeholder {
  color: var(--color-text-4);
}

.editor-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.editor-status {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--color-success-text);
  padding: 2px 6px;
  background: var(--color-success-lighter);
  border-radius: 4px;
}

.btn-cancel-create {
  padding: 4px 10px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-3);
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-create:hover {
  background: var(--color-bg-3);
  color: var(--color-text-2);
}

.btn-delete-memo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.12s;
}

.btn-delete-memo:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* Icon picker */
.editor-icon-wrap {
  position: relative;
  flex-shrink: 0;
}

.editor-icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
  background: var(--color-bg-3);
  color: var(--color-text-3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.editor-icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.editor-icon-emoji {
  font-size: 18px;
  line-height: 1;
}

.icon-picker {
  position: absolute;
  top: 42px;
  left: 0;
  z-index: 100;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  padding: 8px;
  width: 220px;
}

.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.icon-picker-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.12s;
}

.icon-picker-item:hover {
  background: var(--color-bg-3);
  border-color: var(--color-border-light);
}

.icon-picker-clear {
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  border: none;
  background: var(--color-bg-3);
  color: var(--color-text-3);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
}

.icon-picker-clear:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

/* Header export actions */
.btn-header-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-3);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-header-action:hover {
  background: var(--color-bg-3);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Table of Contents */
.toc-wrap {
  position: relative;
}

.toc-panel {
  position: absolute;
  top: 36px;
  right: 0;
  width: 220px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  padding: 8px;
  z-index: 100;
}

.toc-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-4);
  padding: 4px 8px 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toc-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-item:hover {
  background: var(--color-bg-3);
  color: var(--color-primary);
}

.editor-status--message {
  background: var(--color-info-light);
  color: var(--color-info-text, var(--color-info));
}

/* List item icon */
.mli-icon {
  font-size: 13px;
  line-height: 1;
  margin-right: 2px;
}

/* Content editor area */
.editor-content {
  flex: 1;
  min-height: 0;
  padding: 0 24px;
  overflow-y: auto;
}

/* Make RichTextEditor fill the space (Notion style — borderless) */
.editor-content {
  padding-bottom: 0;
}

.editor-content :deep(.rte-wrapper) {
  min-height: 100%;
}

.editor-content :deep(.rte-editor) {
  min-height: 300px;
}

/* Footer */
.editor-footer {
  padding: 12px 24px 16px;
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-light);
}

/* Tags area */
.tag-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-surface);
  transition: border-color 0.15s;
}

.tag-area:focus-within {
  border-color: var(--color-primary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  background: var(--color-info-light);
  color: var(--color-info-text, var(--color-info));
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
}

.tag-remove {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0 1px;
  opacity: 0.6;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  flex: 1;
  min-width: 100px;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--color-text-1);
  background: transparent;
}

.tag-input::placeholder {
  color: var(--color-text-4);
}

/* Editor meta */
.editor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.meta-text {
  font-size: 10px;
  color: var(--color-text-4);
}

/* ===== Skeleton loading ===== */
.memo-skeleton {
  display: flex;
  width: 100%;
  height: 100%;
}

.sk-sidebar {
  width: 300px;
  min-width: 260px;
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-2);
  padding: 16px 12px;
  flex-shrink: 0;
}

.sk-sidebar-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sk-hd-actions {
  display: flex;
  gap: 8px;
}

.sk-search {
  margin-bottom: 14px;
}

.sk-memo-item {
  padding: 10px 8px;
  border-radius: 8px;
  margin-bottom: 2px;
}

.sk-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  padding: 20px 24px;
}

.sk-editor-hd {
  margin-bottom: 20px;
}

.sk-editor-body {
  flex: 1;
}

/* Skeleton primitives */
.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: var(--color-bg-4);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.sk-w-8  { width: 48px; }
.sk-w-10 { width: 64px; }
.sk-w-12 { width: 80px; }
.sk-w-16 { width: 110px; }
.sk-w-20 { width: 140px; }
.sk-w-24 { width: 170px; }
.sk-w-28 { width: 200px; }
.sk-w-32 { width: 220px; }
.sk-w-40 { width: 280px; }
.sk-w-full { width: 100%; }
.sk-h-10 { height: 10px; }
.sk-h-12 { height: 12px; }
.sk-h-14 { height: 14px; }
.sk-h-16 { height: 16px; }
.sk-h-20 { height: 20px; }
.sk-h-22 { height: 22px; }
.sk-h-24 { height: 24px; }

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* ===== Image Lightbox ===== */
.memo-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: lightbox-fade-in 0.2s ease;
  cursor: zoom-out;
}

@keyframes lightbox-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lightbox-close {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
  z-index: 1;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
}

.lightbox-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.4);
  animation: lightbox-zoom-in 0.25s ease;
}

@keyframes lightbox-zoom-in {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
