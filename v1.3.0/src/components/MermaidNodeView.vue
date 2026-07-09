<script setup lang="ts">
/**
 * Mermaid diagram NodeView — renders inline SVG diagrams inside the Tiptap editor.
 * Supports: flowchart, sequence, mindmap, timeline, gantt, class, state, pie, etc.
 */
import { NodeViewWrapper } from '@tiptap/vue-3'
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// ---- Props from VueNodeViewRenderer ----
const props = defineProps<{
  editor: any
  node: any
  getPos: () => number
  deleteNode: () => void
  updateAttributes: (attrs: Record<string, any>) => void
  extension: any
}>()

// ---- State ----
const showToolbar = ref(false)
const editing = ref(false)
const maximized = ref(false)
const editCode = ref('')
const svgContent = ref('')
const renderError = ref('')
const loading = ref(false)

// ---- Resize ----
const resizing = ref(false)
const startDragX = ref(0)
const startDragY = ref(0)
const startWidth = ref(0)
const startHeight = ref(0)
const MIN_WIDTH = 200
const MIN_HEIGHT = 100
const containerEl = ref<HTMLElement | null>(null)

function getContainerMaxWidth(): number {
  if (!containerEl.value) return 1200
  const parent = containerEl.value.parentElement
  return parent ? parent.clientWidth - 32 : 1200
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  resizing.value = true
  startDragX.value = e.clientX
  startDragY.value = e.clientY
  startWidth.value = containerEl.value?.clientWidth ?? (props.node.attrs.width ?? 400)
  startHeight.value = containerEl.value?.clientHeight ?? (props.node.attrs.height ?? 200)
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'nwse-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const deltaX = e.clientX - startDragX.value
  const deltaY = e.clientY - startDragY.value
  const maxW = getContainerMaxWidth()
  const newWidth = Math.max(MIN_WIDTH, Math.min(maxW, startWidth.value + deltaX))
  const newHeight = Math.max(MIN_HEIGHT, startHeight.value + deltaY)
  props.updateAttributes({ width: newWidth, height: newHeight })
}

function stopResize() {
  if (!resizing.value) return
  resizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Use a stable id derived from the node position for mermaid rendering
const containerId = computed(() => `mermaid-${props.getPos()}`)
let renderSeq = 0

// ---- Theme detection ----
function getMermaidTheme(): 'default' | 'dark' {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'dark' ? 'dark' : 'default'
}

// ---- Mermaid rendering ----
async function renderMermaid(code: string): Promise<string> {
  // Dynamic import — mermaid is code-split
  const mermaid = await import('mermaid')

  mermaid.default.initialize({
    startOnLoad: false,
    theme: getMermaidTheme(),
    securityLevel: 'sandbox',
  })

  const id = `${containerId.value}-${++renderSeq}`
  const trimmed = code.trim() || 'graph TD\n  A[Empty]'

  try {
    const { svg } = await mermaid.default.render(id, trimmed)
    return svg
  } finally {
    // 无论成功失败，都清理 mermaid 在 body 中插入的临时 DOM
    // 防止错误 SVG 残留到页面底部
    const ghost = document.getElementById(`d${id}`)
    if (ghost) ghost.remove()
    // 额外清理 mermaid 可能创建的错误 DOM
    document.querySelectorAll('#mermaid-error, .mermaid-error, [id^="mermaid-error"]').forEach(el => el.remove())
  }
}

async function refreshDiagram() {
  renderError.value = ''
  loading.value = true
  try {
    svgContent.value = await renderMermaid(props.node.attrs.code || '')
  } catch (err: any) {
    renderError.value = err?.message || String(err)
    svgContent.value = ''
  } finally {
    loading.value = false
  }
}

// ---- Editor modal ----
function openEditor() {
  editCode.value = props.node.attrs.code || ''
  showToolbar.value = false
  maximized.value = false
  editing.value = true
  nextTick(() => {
    const ta = document.querySelector('.rte-mermaid-textarea') as HTMLTextAreaElement | null
    ta?.focus()
  })
}

// ---- Tab-to-indent in textarea ----
function onTextareaKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const ta = e.target as HTMLTextAreaElement
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = editCode.value.slice(0, start)
    const after = editCode.value.slice(end)
    editCode.value = before + '  ' + after
    // Restore cursor position after the inserted spaces
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
    })
  }
}

// ---- Template system ----
interface Template {
  label: string
  code: string
}
const templates: Template[] = [
  {
    label: '流程图',
    code: 'graph TD\n    A[开始] --> B{判断}\n    B -->|是| C[处理]\n    B -->|否| D[结束]\n    C --> D',
  },
  {
    label: '时序图',
    code: 'sequenceDiagram\n    Alice->>Bob: 你好\n    Bob-->>Alice: 你好!\n    Alice->>Bob: 请求数据\n    Bob-->>Alice: 返回数据',
  },
  {
    label: '思维导图',
    code: 'mindmap\n  root((核心主题))\n    分支一\n      子主题 A\n      子主题 B\n    分支二\n      子主题 C\n      子主题 D\n    分支三\n      子主题 E',
  },
  {
    label: '类图',
    code: 'classDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    class Cat {\n        +scratch()\n    }\n    Animal <|-- Dog\n    Animal <|-- Cat',
  },
  {
    label: '状态图',
    code: 'stateDiagram-v2\n    [*] --> 待处理\n    待处理 --> 处理中: 开始\n    处理中 --> 已完成: 成功\n    处理中 --> 已失败: 异常\n    已失败 --> 处理中: 重试\n    已完成 --> [*]\n    已失败 --> [*]',
  },
  {
    label: '甘特图',
    code: 'gantt\n    title 项目计划\n    dateFormat  YYYY-MM-DD\n    section 设计\n    需求分析     :2026-01-01, 7d\n    原型设计     :7d\n    section 开发\n    后端开发     :14d\n    前端开发     :14d\n    section 测试\n    集成测试     :5d',
  },
  {
    label: '饼图',
    code: 'pie title 市场份额\n    "产品A" : 45\n    "产品B" : 30\n    "产品C" : 15\n    "其他" : 10',
  },
  {
    label: 'ER图',
    code: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n        string name\n        string email\n    }\n    ORDER {\n        int orderNumber\n        date orderDate\n    }\n    LINE-ITEM {\n        string productCode\n        int quantity\n    }',
  },
  {
    label: 'Git图',
    code: 'gitGraph\n    commit id: "初始提交"\n    branch develop\n    checkout develop\n    commit id: "功能A"\n    commit id: "功能B"\n    checkout main\n    merge develop tag: "v1.0"',
  },
  {
    label: '象限图',
    code: 'quadrantChart\n    title 优先级矩阵\n    x-axis 低影响 --> 高影响\n    y-axis 低紧急 --> 高紧急\n    quadrant-1 立即处理\n    quadrant-2 计划安排\n    quadrant-3 委派他人\n    quadrant-4 稍后处理\n    登录优化: [0.75, 0.8]\n    颜色主题: [0.35, 0.3]\n    安全漏洞: [0.9, 0.95]\n    文档更新: [0.2, 0.4]',
  },
  {
    label: '时间线',
    code: 'timeline\n    title 项目里程碑\n    2025-Q4 : 需求调研 : 技术选型 : 原型设计\n    2026-Q1 : 后端开发 : 前端开发\n    2026-Q2 : 集成测试 : 上线部署',
  },
]

async function applyTemplate(code: string) {
  editCode.value = code
  // Immediately render preview bypassing debounce
  if (previewTimer) clearTimeout(previewTimer)
  try {
    const svg = await renderMermaid(code)
    const previewEl = document.querySelector('.rte-mermaid-modal-preview')
    if (previewEl) previewEl.innerHTML = svg
  } catch {
    // Silently ignore
  }
}

// Debounced preview in the modal
let previewTimer: ReturnType<typeof setTimeout> | null = null

function onEditInput() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    try {
      const svg = await renderMermaid(editCode.value)
      const previewEl = document.querySelector('.rte-mermaid-modal-preview')
      if (previewEl) previewEl.innerHTML = svg
    } catch {
      // Silently ignore preview errors while typing
    }
  }, 500)
}

function cancelEdit() {
  // Restore preview to current stored code
  editing.value = false
  refreshDiagram()
}

function saveEdit() {
  editing.value = false
  props.updateAttributes({ code: editCode.value })
  // The watch on props.node.attrs will trigger refreshDiagram
}

// ---- Delete ----
const deleteConfirmVisible = ref(false)

function confirmDelete() {
  deleteConfirmVisible.value = true
}

function handleConfirmDelete() {
  deleteConfirmVisible.value = false
  props.deleteNode()
}

function handleCancelDelete() {
  deleteConfirmVisible.value = false
}

// ---- Keyboard: delete on Backspace when selected ----
// (handled by ProseMirror's default behavior, no extra code needed)

// ---- Lifecycle ----
onMounted(() => {
  refreshDiagram()
})

// Watch for attribute changes (e.g., undo/redo, external update)
watch(
  () => props.node.attrs.code,
  () => {
    if (!editing.value) refreshDiagram()
  }
)

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})
</script>

<template>
  <NodeViewWrapper>
    <div
      ref="containerEl"
      class="rte-mermaid-block"
      :class="{ 'rte-mermaid-resizing': resizing }"
      :style="[props.node.attrs.width ? { width: props.node.attrs.width + 'px' } : {}, props.node.attrs.height ? { height: props.node.attrs.height + 'px' } : {}]"
      contenteditable="false"
      @mouseenter="showToolbar = true"
      @mouseleave="showToolbar = false"
    >
      <!-- Hover toolbar -->
      <div v-if="showToolbar && !editing" class="rte-mermaid-toolbar">
        <button
          type="button"
          class="rte-mermaid-toolbar-btn"
          title="编辑图表"
          @mousedown.prevent
          @click.stop="openEditor"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          type="button"
          class="rte-mermaid-toolbar-btn rte-mermaid-toolbar-btn-danger"
          title="删除图表"
          @mousedown.prevent
          @click.stop="confirmDelete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <!-- Diagram or error -->
      <div v-if="loading" class="rte-mermaid-loading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="rte-mermaid-spinner">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span>渲染中...</span>
      </div>
      <div v-else-if="renderError" class="rte-mermaid-error">
        <div class="rte-mermaid-error-icon">⚠</div>
        <div class="rte-mermaid-error-msg">{{ renderError }}</div>
        <button type="button" class="rte-mermaid-error-btn" @click.stop="openEditor">编辑修复</button>
      </div>
      <div
        v-else
        class="rte-mermaid-preview"
        v-html="svgContent"
        @dblclick.stop="openEditor"
      />

      <!-- Resize handle -->
      <div
        v-if="showToolbar && !editing"
        class="rte-mermaid-resize-handle"
        @mousedown="startResize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M0 8h2v2H0zM3 5h2v2H3zM6 2h2v2H6zM0 5h2v2H0zM3 2h2v2H3zM6 8h2v2H6zM0 2h2v2H0z"/>
        </svg>
      </div>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="rte-mermaid-modal-overlay"
        @mousedown.self="cancelEdit"
      >
        <div class="rte-mermaid-modal" :class="{ 'rte-mermaid-modal-maximized': maximized }" @mousedown.stop>
          <div class="rte-mermaid-modal-header">
            <h3>Mermaid 图表编辑器</h3>
            <div class="rte-mermaid-modal-header-right">
              <span class="rte-mermaid-modal-hint">支持流程图、时序图、思维导图、甘特图等</span>
              <button
                type="button"
                class="rte-mermaid-modal-btn-icon"
                :title="maximized ? '还原' : '最大化'"
                @click="maximized = !maximized"
              >
                <svg v-if="!maximized" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 8 4 4 8 4"/>
                  <polyline points="20 16 20 20 16 20"/>
                  <line x1="4" y1="4" x2="9" y2="9"/>
                  <line x1="20" y1="20" x2="15" y2="15"/>
                </svg>
              </button>
              <button
                type="button"
                class="rte-mermaid-modal-btn-icon"
                @click="cancelEdit"
                title="关闭"
              >&times;</button>
            </div>
          </div>
          <div class="rte-mermaid-modal-body">
            <!-- Code editor (left) -->
            <div class="rte-mermaid-modal-editor">
              <div class="rte-mermaid-modal-label">Mermaid 代码</div>
              <textarea
                v-model="editCode"
                class="rte-mermaid-textarea"
                spellcheck="false"
                @input="onEditInput"
                @keydown="onTextareaKeydown"
                placeholder="输入 Mermaid 代码..."
              ></textarea>
            </div>
            <!-- Live preview (right) -->
            <div class="rte-mermaid-modal-preview-panel">
              <div class="rte-mermaid-modal-label">实时预览</div>
              <div
                class="rte-mermaid-modal-preview"
                v-html="svgContent"
              />
            </div>
          </div>
          <div class="rte-mermaid-modal-footer">
            <div class="rte-mermaid-modal-templates">
              <span class="rte-mermaid-templates-label">模板：</span>
              <button
                v-for="tpl in templates"
                :key="tpl.label"
                type="button"
                class="rte-mermaid-template-btn"
                @click="applyTemplate(tpl.code)"
              >{{ tpl.label }}</button>
            </div>
            <div class="rte-mermaid-modal-actions">
              <button type="button" class="rte-mermaid-btn rte-mermaid-btn-cancel" @click="cancelEdit">取消</button>
              <button type="button" class="rte-mermaid-btn rte-mermaid-btn-save" @click="saveEdit">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="删除图表"
      message="确定要删除此 Mermaid 图表吗？此操作不可恢复。"
      confirm-text="删除"
      type="danger"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />
  </NodeViewWrapper>
</template>

<style scoped>
/* ---- Block wrapper ---- */
.rte-mermaid-block {
  position: relative;
  margin: 12px 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--color-surface, #ffffff);
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: default;
  overflow: hidden;
}
.rte-mermaid-block.rte-mermaid-resizing {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
  transition: none;
}
.rte-mermaid-block:hover {
  border-color: var(--color-border-light, #e5e7eb);
  box-shadow: 0 0 0 1px var(--color-border-light, #e5e7eb);
}

/* ---- Toolbar ---- */
.rte-mermaid-toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  z-index: 10;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.rte-mermaid-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--color-text-2, #4b5563);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0;
}
.rte-mermaid-toolbar-btn:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #1f2937);
}
.rte-mermaid-toolbar-btn-danger:hover {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}

/* ---- Preview ---- */
.rte-mermaid-preview {
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
  overflow-x: auto;
}
.rte-mermaid-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* ---- Loading ---- */
.rte-mermaid-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--color-text-3, #9ca3af);
  font-size: 13px;
}
.rte-mermaid-spinner {
  animation: rte-mermaid-spin 1s linear infinite;
}
@keyframes rte-mermaid-spin {
  to { transform: rotate(360deg); }
}

/* ---- Error ---- */
.rte-mermaid-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: color-mix(in srgb, var(--color-danger, #ef4444) 5%, transparent);
  border: 1px dashed var(--color-danger, #ef4444);
  border-radius: 8px;
  margin: 12px;
  min-height: 80px;
  justify-content: center;
}
.rte-mermaid-error-icon {
  font-size: 24px;
}
.rte-mermaid-error-msg {
  font-size: 12px;
  color: var(--color-danger, #ef4444);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  text-align: center;
  max-width: 100%;
  word-break: break-all;
}
.rte-mermaid-error-btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-surface, #fff);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-2, #4b5563);
  transition: background 0.15s;
}
.rte-mermaid-error-btn:hover {
  background: var(--color-bg-3, #f3f4f6);
}

/* ---- Modal ---- */
.rte-mermaid-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.rte-mermaid-modal {
  background: var(--color-surface, #ffffff);
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.2);
  width: min(960px, 94vw);
  height: 80vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-radius 0.2s;
}
.rte-mermaid-modal-maximized {
  position: fixed;
  inset: 0;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none;
  max-height: none;
  border-radius: 0;
}

/* Modal header */
.rte-mermaid-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  flex-shrink: 0;
}
.rte-mermaid-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1, #1f2937);
}
.rte-mermaid-modal-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rte-mermaid-modal-hint {
  font-size: 12px;
  color: var(--color-text-4, #9ca3af);
}
.rte-mermaid-modal-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: var(--color-text-3, #6b7280);
  padding: 0 4px;
  line-height: 1;
  border-radius: 4px;
  transition: background 0.15s;
  width: 28px;
  height: 28px;
}
.rte-mermaid-modal-btn-icon:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #1f2937);
}

/* Modal body: split layout */
.rte-mermaid-modal-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.rte-mermaid-modal-editor,
.rte-mermaid-modal-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rte-mermaid-modal-editor {
  border-right: 1px solid var(--color-border-light, #e5e7eb);
}
.rte-mermaid-modal-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3, #6b7280);
  padding: 8px 16px 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.rte-mermaid-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 8px 16px 16px;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-1, #1f2937);
  background: var(--color-surface, #fff);
  tab-size: 2;
}
.rte-mermaid-modal-preview {
  flex: 1;
  padding: 12px 16px 16px;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--color-bg-1, #f9fafb);
}
.rte-mermaid-modal-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* Modal footer */
.rte-mermaid-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.rte-mermaid-modal-templates {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rte-mermaid-templates-label {
  font-size: 12px;
  color: var(--color-text-3, #6b7280);
}
.rte-mermaid-template-btn {
  padding: 3px 10px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-surface, #fff);
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-2, #4b5563);
  transition: all 0.15s;
}
.rte-mermaid-template-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}
.rte-mermaid-modal-actions {
  display: flex;
  gap: 8px;
}
.rte-mermaid-btn {
  padding: 6px 18px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.rte-mermaid-btn-cancel {
  background: transparent;
  border-color: var(--color-border-light, #e5e7eb);
  color: var(--color-text-2, #4b5563);
}
.rte-mermaid-btn-cancel:hover {
  background: var(--color-bg-3, #f3f4f6);
}
.rte-mermaid-btn-save {
  background: var(--color-primary, #3b82f6);
  color: #ffffff;
}
.rte-mermaid-btn-save:hover {
  filter: brightness(1.1);
}

/* ---- Resize handle ---- */
.rte-mermaid-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  cursor: nwse-resize;
  color: var(--color-text-4, #9ca3af);
  padding: 2px;
  opacity: 0.6;
  transition: opacity 0.15s, color 0.15s;
  z-index: 5;
}
.rte-mermaid-resize-handle:hover {
  opacity: 1;
  color: var(--color-primary, #3b82f6);
}
</style>
