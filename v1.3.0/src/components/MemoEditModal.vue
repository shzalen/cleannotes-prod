<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { MemoItem } from '@/types'
import { useMemoStore } from '@/stores/memo'
import RichTextEditor from '@/components/RichTextEditor.vue'

const store = useMemoStore()
const visible = ref(false)
const editingMemo = ref<MemoItem | null>(null)
const isNew = ref(true)

const title = ref('')
const content = ref('')
const tagInput = ref('')
const tags = ref<string[]>([])

const titleInputRef = ref<HTMLInputElement | null>(null)

watch(visible, (val) => {
  if (val) {
    nextTick(() => titleInputRef.value?.focus())
  }
})

// ---- 新建备忘录草稿 ----
let justSaved = false

function getDraftKey() {
  try {
    const sessionRaw = localStorage.getItem('cleannote_session')
    const userId = sessionRaw ? (JSON.parse(sessionRaw).userId ?? '') : ''
    return userId ? `cleannotes_${userId}_memo_draft` : 'cleannotes_memo_draft'
  } catch { return 'cleannotes_memo_draft' }
}

function saveDraft() {
  if (!isNew.value || justSaved) return
  const hasContent = title.value.trim() || content.value.trim()
  if (!hasContent) {
    clearDraft()
    return
  }
  localStorage.setItem(getDraftKey(), JSON.stringify({
    title: title.value,
    content: content.value,
    tags: tags.value,
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
    if (!d.title?.trim() && !d.content?.trim()) return false
    title.value = d.title || ''
    content.value = d.content || ''
    tags.value = Array.isArray(d.tags) ? d.tags : []
    return true
  } catch { return false }
}

function openNew() {
  isNew.value = true
  editingMemo.value = null
  justSaved = false
  title.value = ''
  content.value = ''
  tagInput.value = ''
  tags.value = []
  // 尝试恢复上次未保存的草稿
  loadDraft()
  visible.value = true
}

function openEdit(memo: MemoItem) {
  isNew.value = false
  editingMemo.value = memo
  title.value = memo.title
  content.value = memo.content
  tagInput.value = ''
  tags.value = [...memo.tags]
  visible.value = true
}

function close() {
  saveDraft() // 新建备忘录关闭前保存草稿
  visible.value = false
  editingMemo.value = null
}

function addTag() {
  const val = tagInput.value.trim()
  if (!val) return
  if (tags.value.includes(val)) return
  tags.value.push(val)
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
}

function onTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
}

function save() {
  if (!title.value.trim()) return

  if (isNew.value) {
    store.addMemo({
      title: title.value.trim(),
      content: content.value.trim(),
      tags: [...tags.value],
      pinned: false,
    })
    justSaved = true
  } else if (editingMemo.value) {
    store.updateMemo(editingMemo.value.id, {
      title: title.value.trim(),
      content: content.value.trim(),
      tags: [...tags.value],
    })
  }
  clearDraft()
  close()
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

defineExpose({ openNew, openEdit, close })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick" @keydown="onKeydown">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="new-badge">{{ isNew ? '新建' : '编辑' }}</span>
            <h3 class="modal-title">
              {{ isNew ? '新建备忘录' : '编辑备忘录' }}
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
              placeholder="输入备忘录标题..."
            />
          </div>

          <!-- Content -->
          <div class="form-group desc-group">
            <label class="field-label">内容</label>
            <RichTextEditor
              v-model="content"
              placeholder="输入备忘录内容…"
            />
          </div>

          <!-- Tags -->
          <div class="form-group">
            <label class="field-label">标签</label>
            <div class="tag-area">
              <div class="tag-list">
                <span
                  v-for="tag in tags"
                  :key="tag"
                  class="tag-chip"
                >
                  {{ tag }}
                  <button class="tag-remove" @click="removeTag(tag)">&times;</button>
                </span>
              </div>
              <input
                v-model="tagInput"
                class="tag-input"
                placeholder="输入标签后回车..."
                @keydown="onTagKeydown"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <span class="footer-spacer" />
          <button class="btn-cancel" @click="close">取消</button>
          <button class="btn-save" :disabled="!title.trim()" @click="save">
            {{ isNew ? '创建' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ---- Overlay（统一风格） ---- */
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
  width: 680px;
  max-width: 94vw;
  max-height: 88vh;
  background: var(--color-surface);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px var(--color-shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

/* ---- Header ---- */
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
  color: var(--color-text-1);
}

.new-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-info-light);
  color: var(--color-info);
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

/* ---- Body ---- */
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

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-3);
  letter-spacing: 0.3px;
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

.title-input {
  font-size: 15px;
  font-weight: 500;
}

.desc-group {
  flex: 1;
  min-height: 0;
}

/* ---- Tags ---- */
.tag-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  transition: border-color 0.15s;
}

.tag-area:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 0;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: var(--color-info-light);
  color: var(--color-info-text, var(--color-info));
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.tag-remove {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 1px;
  opacity: 0.6;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--color-text-1);
  background: transparent;
  padding: 2px 0;
  min-width: 120px;
}

.tag-input::placeholder {
  color: var(--color-text-4);
}

/* ---- Footer ---- */
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
  color: #fff;
  background: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-save:not(:disabled):hover {
  opacity: 0.85;
}
</style>
