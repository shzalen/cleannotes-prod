<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { TodoItem } from '@/types'
import { useTodoStore } from '@/stores/todo'

const store = useTodoStore()
const visible = ref(false)
const editingTodo = ref<TodoItem | null>(null)
const isNew = ref(true)

const title = ref('')
const description = ref('')
const estimatedStart = ref('')
const estimatedEnd = ref('')
const importance = ref(0)

const titleInputRef = ref<HTMLInputElement | null>(null)

watch(visible, (val) => {
  if (val) {
    nextTick(() => titleInputRef.value?.focus())
  }
})

// ---- 新建待办草稿 ----
let justSaved = false

function getDraftKey() {
  try {
    const sessionRaw = localStorage.getItem('cleannote_session')
    const userId = sessionRaw ? (JSON.parse(sessionRaw).userId ?? '') : ''
    return userId ? `cleannotes_${userId}_todo_draft` : 'cleannotes_todo_draft'
  } catch { return 'cleannotes_todo_draft' }
}

function saveDraft() {
  if (!isNew.value || justSaved) return
  const hasContent = title.value.trim() || description.value.trim()
  if (!hasContent) {
    clearDraft()
    return
  }
  localStorage.setItem(getDraftKey(), JSON.stringify({
    title: title.value,
    description: description.value,
    estimatedStart: estimatedStart.value,
    estimatedEnd: estimatedEnd.value,
    importance: importance.value,
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
    estimatedStart.value = d.estimatedStart || ''
    estimatedEnd.value = d.estimatedEnd || ''
    importance.value = d.importance ?? 0
    return true
  } catch { return false }
}

function openNew() {
  isNew.value = true
  editingTodo.value = null
  justSaved = false
  title.value = ''
  description.value = ''
  estimatedStart.value = ''
  estimatedEnd.value = ''
  importance.value = 0
  // 尝试恢复上次未保存的草稿
  loadDraft()
  visible.value = true
}

function openEdit(todo: TodoItem) {
  isNew.value = false
  editingTodo.value = todo
  title.value = todo.title
  description.value = todo.description
  estimatedStart.value = todo.estimatedStart || ''
  estimatedEnd.value = todo.estimatedEnd || ''
  importance.value = todo.importance ?? 0
  visible.value = true
}

function close() {
  saveDraft() // 新建待办关闭前保存草稿
  visible.value = false
  editingTodo.value = null
}

function save() {
  if (!title.value.trim()) return

  if (isNew.value) {
    store.addTodo({
      title: title.value.trim(),
      description: description.value.trim(),
      estimatedStart: estimatedStart.value || null,
      estimatedEnd: estimatedEnd.value || null,
      importance: importance.value,
    })
    justSaved = true
  } else if (editingTodo.value) {
    store.updateTodo(editingTodo.value.id, {
      title: title.value.trim(),
      description: description.value.trim(),
      estimatedStart: estimatedStart.value || null,
      estimatedEnd: estimatedEnd.value || null,
      importance: importance.value,
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
              {{ isNew ? '新建待办' : '编辑待办' }}
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
              placeholder="输入待办标题..."
            />
          </div>

          <!-- Importance (star rating) -->
          <div class="form-group">
            <label class="field-label">重要等级</label>
            <div class="star-row">
              <button
                v-for="n in 5"
                :key="n"
                class="star-btn"
                :class="{ active: n <= importance }"
                @click="importance = importance === n ? n - 1 : n"
                :title="`${n}级`"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="n <= importance ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <span class="star-hint">{{ importance > 0 ? `${importance}级` : '未评级' }}</span>
            </div>
          </div>

          <!-- Date range -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="field-label">预计开始</label>
              <input v-model="estimatedStart" class="field-input" type="date" />
            </div>
            <div class="form-group flex-1">
              <label class="field-label">预计结束</label>
              <input v-model="estimatedEnd" class="field-input" type="date" />
            </div>
          </div>

          <!-- Description -->
          <div class="form-group desc-group">
            <label class="field-label">描述</label>
            <textarea
              v-model="description"
              class="field-textarea"
              placeholder="输入待办描述..."
              rows="5"
            ></textarea>
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
/* ---- Overlay（与 TaskEditModal 一致） ---- */
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
  width: 560px;
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

.flex-1 {
  flex: 1;
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

.form-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

/* Description group fills remaining space */
.desc-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.field-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-text-1);
  outline: none;
  resize: vertical;
  line-height: 1.7;
  min-height: 100px;
  transition: border-color 0.15s;
  background: var(--color-surface);
  flex: 1;
}

.field-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
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

/* ---- Star rating ---- */
.star-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-4);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
  padding: 0;
}

.star-btn:hover {
  background: var(--color-warning-lighter, rgba(255, 193, 7, 0.08));
  color: var(--color-warning, #f0a020);
}

.star-btn.active {
  color: var(--color-warning, #f0a020);
}

.star-hint {
  font-size: 11px;
  color: var(--color-text-4);
  margin-left: 6px;
}
</style>
