<script setup lang="ts">
/**
 * XMind-style mindmap NodeView — renders interactive mindmaps inside the Tiptap editor.
 * Powered by markmap (markmap-lib + markmap-view).
 */
import { NodeViewWrapper } from '@tiptap/vue-3'
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
const svgEl = ref<SVGSVGElement | null>(null)
const previewSvgEl = ref<SVGSVGElement | null>(null)
const loading = ref(false)
const renderError = ref('')

// ---- Resize ----
const resizing = ref(false)
const startDragX = ref(0)
const startDragY = ref(0)
const startWidth = ref(0)
const startHeight = ref(0)
const MIN_WIDTH = 280
const MIN_HEIGHT = 200
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
  startWidth.value = containerEl.value?.clientWidth ?? (props.node.attrs.width ?? 600)
  startHeight.value = containerEl.value?.clientHeight ?? (props.node.attrs.height ?? 400)
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

// ---- XMind-inspired color palette ----
const BRANCH_PALETTE = [
  '#E74C3C', // Coral  — 暖红
  '#3498DB', // Blue   — 天蓝
  '#2ECC71', // Green  — 翠绿
  '#F39C12', // Amber  — 琥珀
  '#9B59B6', // Purple — 紫晶
  '#1ABC9C', // Teal   — 青绿
  '#E91E63', // Rose   — 玫红
  '#00BCD4', // Cyan   — 青蓝
]
const ROOT_COLOR = '#34495E'

/** Parse hex → HSL, return [h, s%, l%] */
function hexToHsl(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0
  const h = hex.replace('#', '')
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255
    g = parseInt(h[1] + h[1], 16) / 255
    b = parseInt(h[2] + h[2], 16) / 255
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255
    g = parseInt(h.substring(2, 4), 16) / 255
    b = parseInt(h.substring(4, 6), 16) / 255
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let hue = 0, sat = 0
  const lit = (max + min) / 2
  if (max !== min) {
    const d = max - min
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: hue = ((b - r) / d + 2) / 6; break
      case b: hue = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(hue * 360), Math.round(sat * 100), Math.round(lit * 100)]
}

/** Lighten/saturate a hex color for child nodes */
function deriveChildColor(hex: string, depth: number): string {
  const [h, s, l] = hexToHsl(hex)
  const newS = Math.max(30, s - (depth - 1) * 8)
  const newL = Math.min(92, l + (depth - 1) * 7)
  return `hsl(${h}, ${newS}%, ${newL}%)`
}

/** Color callback for markmap — branch-family coloring */
function nodeColorFn(node: any): string {
  const depth = node.state?.depth ?? node.d ?? 0
  if (depth === 0) return ROOT_COLOR

  const path: string = node.state?.path ?? ''
  const parts = path.split('.')
  // "0.2.1" → parts[1]="2" → branch index
  const branchIdx = parts.length > 1 ? parseInt(parts[1], 10) : 0
  const base = BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length]

  if (depth === 1) return base
  return deriveChildColor(base, depth)
}

/** Style callback — injects custom CSS into the SVG for XMind-grade polish */
function mindmapStyleFn(id: string): string {
  return `
    .${id} [data-depth="0"] > rect {
      rx: 8px; ry: 8px;
    }
    .${id} .markmap-node > rect {
      rx: 6px; ry: 6px;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.08));
      transition: filter 0.2s;
    }
    .${id} .markmap-node:hover > rect {
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
    }
    .${id} .markmap-link {
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      transition: stroke 0.3s, stroke-width 0.3s;
    }
    .${id} .markmap-foreign {
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #333;
    }
    .${id} [data-depth="0"] .markmap-foreign {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .${id} [data-depth="1"] .markmap-foreign {
      font-size: 15px;
      font-weight: 600;
    }
    .${id} [data-depth="2"] .markmap-foreign {
      font-size: 14px;
      color: #444;
    }
    .${id} [data-depth="3"] .markmap-foreign,
    .${id} [data-depth="4"] .markmap-foreign {
      font-size: 13px;
      color: #555;
    }
  `
}

// ---- markmap rendering ----
let mmInstance: any = null
let previewMm: any = null

async function getMarkmapModules() {
  const [lib, view] = await Promise.all([
    import('markmap-lib'),
    import('markmap-view'),
  ])
  return { Transformer: lib.Transformer, Markmap: view.Markmap }
}

/**
 * R5-S01: Defensive SVG sanitization — removes <script> tags and on* event
 * attributes from the rendered SVG without destroying markmap's internal
 * DOM references. Complements input HTML stripping + CSP defense layers.
 */
function sanitizeSvg(svgEl: SVGElement) {
  // Remove any script elements
  svgEl.querySelectorAll('script').forEach(el => el.remove())
  // Remove all on* event handler attributes
  svgEl.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes || []).forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })
  })
}

async function renderInline() {
  const rawCode = props.node.attrs.code || ''
  if (!rawCode.trim() || !svgEl.value) return

  // Strip HTML tags to prevent SVG injection — mindmap uses markdown syntax only
  const code = rawCode.replace(/<[^>]*>/g, '')
  renderError.value = ''
  loading.value = true
  try {
    const { Transformer, Markmap } = await getMarkmapModules()
    const transformer = new Transformer()
    const { root, features } = transformer.transform(code)

    if (mmInstance) {
      mmInstance.setData(root)
      await mmInstance.fit()
    } else {
      // Remove any existing children (re-render on hot-reload)
      svgEl.value.innerHTML = ''
      mmInstance = Markmap.create(svgEl.value, {
        autoFit: true,
        duration: 300,
        maxWidth: 280,
        paddingX: 20,
        spacingVertical: 8,
        spacingHorizontal: 60,
        color: nodeColorFn,
        style: mindmapStyleFn,
      }, root)
    }
    // R5-S01: Defensive sanitization — remove script tags and on* attributes from rendered SVG
    sanitizeSvg(svgEl.value)
  } catch (err: any) {
    renderError.value = err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function renderPreview(code: string) {
  if (!previewSvgEl.value || !code.trim()) return
  // Strip HTML tags to prevent SVG injection
  const sanitizedCode = code.replace(/<[^>]*>/g, '')
  try {
    const { Transformer, Markmap } = await getMarkmapModules()
    const transformer = new Transformer()
    const { root } = transformer.transform(sanitizedCode)

    if (previewMm) {
      previewMm.setData(root)
      await previewMm.fit()
    } else {
      previewSvgEl.value.innerHTML = ''
      previewMm = Markmap.create(previewSvgEl.value, {
        autoFit: true,
        duration: 200,
        maxWidth: 280,
        paddingX: 20,
        spacingVertical: 8,
        spacingHorizontal: 60,
        color: nodeColorFn,
        style: mindmapStyleFn,
      }, root)
    }
    // R5-S01: Defensive sanitization
    if (previewSvgEl.value) sanitizeSvg(previewSvgEl.value)
  } catch {
    // Silently ignore preview errors
  }
}

// ---- Editor modal ----
function openEditor() {
  editCode.value = props.node.attrs.code || ''
  showToolbar.value = false
  maximized.value = false
  editing.value = true
  nextTick(async () => {
    const ta = document.querySelector('.rte-mindmap-textarea') as HTMLTextAreaElement | null
    ta?.focus()
    await renderPreview(editCode.value)
  })
}

// ---- Tab-to-indent ----
function onTextareaKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const ta = e.target as HTMLTextAreaElement
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = editCode.value.slice(0, start)
    const after = editCode.value.slice(end)
    editCode.value = before + '  ' + after
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
    label: '默认',
    code: '# 核心主题\n## 分支一\n### 子主题 A\n### 子主题 B\n## 分支二\n### 子主题 C\n### 子主题 D\n## 分支三\n### 子主题 E',
  },
  {
    label: '目标拆解',
    code: '# 年度目标\n## 技术提升\n### 深入学习 Vue 3\n### 掌握性能优化\n### 阅读源码\n## 项目交付\n### Q1 重构项目\n### Q2 新功能上\n### Q3 技术分享\n## 个人成长\n### 每周阅读\n### 英语学习\n### 运动计划',
  },
  {
    label: '会议纪要',
    code: '# 周会纪要\n## 上周回顾\n### 已完成功能 A\n### 修复 Bug B\n## 本周计划\n### 开发功能 C\n### Code Review\n## 风险与阻塞\n### 依赖方延迟\n### 资源不足\n## 待办事项\n### 跟进行动项\n### 发会议纪要',
  },
  {
    label: '知识体系',
    code: '# 前端知识体系\n## HTML/CSS\n### 语义化\n### Flexbox\n### Grid\n### 动画\n## JavaScript\n### ES6+\n### 异步编程\n### 设计模式\n## 框架\n### Vue\n### React\n### 状态管理\n## 工程化\n### Webpack\n### Vite\n### CI/CD',
  },
  {
    label: '产品分析',
    code: '# 竞品分析\n## 产品 A\n### 优势\n### 劣势\n### 差异化\n## 产品 B\n### 用户规模\n### 核心功能\n### 定价策略\n## 我们的定位\n### 目标用户\n### 核心卖点\n### 增长策略',
  },
  {
    label: '读书笔记',
    code: '# 书名\n## 核心观点\n### 观点一\n### 观点二\n## 关键案例\n### 案例 A\n### 案例 B\n## 行动启示\n### 可落地的 3 件事\n### 需要避免的坑',
  },
  {
    label: 'SWOT分析',
    code: '# SWOT 分析\n## 优势 (S)\n### 技术壁垒\n### 团队能力\n### 用户基础\n## 劣势 (W)\n### 资源有限\n### 品牌知名度\n### 经验不足\n## 机会 (O)\n### 市场增长\n### 政策利好\n### 技术变革\n## 威胁 (T)\n### 竞争加剧\n### 用户流失\n### 成本上升',
  },
  {
    label: '项目规划',
    code: '# 项目名\n## 启动阶段\n### 需求分析\n### 技术选型\n### 原型设计\n## 执行阶段\n### Sprint 1\n### Sprint 2\n### Sprint 3\n## 收尾阶段\n### 测试\n### 部署\n### 复盘',
  },
  {
    label: '问题分析',
    code: '# 问题描述\n## 现象\n### 具体表现\n### 影响范围\n## 根因\n### 直接原因\n### 间接原因\n## 方案\n### 临时方案\n### 长期方案\n### 预防措施',
  },
  {
    label: '旅行计划',
    code: '# 旅行计划\n## 目的地\n### 景点 A\n### 景点 B\n## 交通\n### 机票\n### 当地交通\n## 住宿\n### 酒店选择\n### 预算\n## 美食\n### 推荐餐厅\n### 特色小吃',
  },
]

async function applyTemplate(code: string) {
  editCode.value = code
  await renderPreview(code)
}

// Debounced preview in modal
let previewTimer: ReturnType<typeof setTimeout> | null = null

function onEditInput() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    renderPreview(editCode.value)
  }, 400)
}

function cancelEdit() {
  editing.value = false
  if (previewMm) {
    previewMm.destroy()
    previewMm = null
  }
  // Refresh inline render
  nextTick(() => renderInline())
}

function saveEdit() {
  editing.value = false
  if (previewMm) {
    previewMm.destroy()
    previewMm = null
  }
  props.updateAttributes({ code: editCode.value })
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

// ---- Toolbar actions ----
function fitView() {
  mmInstance?.fit()
}

function zoomIn() {
  if (mmInstance) {
    mmInstance.rescale(mmInstance.state.scale * 1.2)
  }
}

function zoomOut() {
  if (mmInstance) {
    mmInstance.rescale(mmInstance.state.scale * 0.8)
  }
}

// ---- Lifecycle ----
onMounted(() => {
  nextTick(() => renderInline())
})

watch(
  () => props.node.attrs.code,
  () => {
    if (!editing.value) nextTick(() => renderInline())
  }
)

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  if (mmInstance) {
    mmInstance.destroy()
    mmInstance = null
  }
  if (previewMm) {
    previewMm.destroy()
    previewMm = null
  }
})
</script>

<template>
  <NodeViewWrapper>
    <div
      ref="containerEl"
      class="rte-mindmap-block"
      :class="{ 'rte-mindmap-resizing': resizing }"
      :style="[
        props.node.attrs.width ? { width: props.node.attrs.width + 'px' } : {},
        props.node.attrs.height ? { height: props.node.attrs.height + 'px' } : {},
      ]"
      contenteditable="false"
      @mouseenter="showToolbar = true"
      @mouseleave="showToolbar = false"
    >
      <!-- Hover toolbar -->
      <div v-if="showToolbar && !editing" class="rte-mindmap-toolbar">
        <button
          type="button"
          class="rte-mindmap-toolbar-btn"
          title="编辑"
          @mousedown.prevent
          @click.stop="openEditor"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <div class="rte-mindmap-toolbar-sep" />
        <button
          type="button"
          class="rte-mindmap-toolbar-btn"
          title="适应画面"
          @mousedown.prevent
          @click.stop="fitView"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        </button>
        <button
          type="button"
          class="rte-mindmap-toolbar-btn"
          title="放大"
          @mousedown.prevent
          @click.stop="zoomIn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button
          type="button"
          class="rte-mindmap-toolbar-btn"
          title="缩小"
          @mousedown.prevent
          @click.stop="zoomOut"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <div class="rte-mindmap-toolbar-sep" />
        <button
          type="button"
          class="rte-mindmap-toolbar-btn rte-mindmap-toolbar-btn-danger"
          title="删除"
          @mousedown.prevent
          @click.stop="confirmDelete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="rte-mindmap-loading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="rte-mindmap-spinner">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span>渲染中...</span>
      </div>

      <!-- Error -->
      <div v-else-if="renderError" class="rte-mindmap-error">
        <div class="rte-mindmap-error-icon">⚠</div>
        <div class="rte-mindmap-error-msg">{{ renderError }}</div>
        <button type="button" class="rte-mindmap-error-btn" @click.stop="openEditor">编辑修复</button>
      </div>

      <!-- Mindmap SVG (rendered by markmap-view, invisible until rendered) -->
      <svg
        v-show="!loading && !renderError"
        ref="svgEl"
        class="rte-mindmap-svg"
        @dblclick.stop="openEditor"
      />

      <!-- Resize handle -->
      <div
        v-if="showToolbar && !editing"
        class="rte-mindmap-resize-handle"
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
        class="rte-mindmap-modal-overlay"
        @mousedown.self="cancelEdit"
      >
        <div class="rte-mindmap-modal" :class="{ 'rte-mindmap-modal-maximized': maximized }" @mousedown.stop>
          <div class="rte-mindmap-modal-header">
            <h3 class="rte-mindmap-modal-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rte-mindmap-title-icon">
                <circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 13h2"/><path d="M16 13h2"/><path d="M10 11l-2 4"/><path d="M14 11l2 4"/>
              </svg>
              <span>思维导图编辑器</span>
            </h3>
            <div class="rte-mindmap-modal-header-right">
              <span class="rte-mindmap-modal-hint">使用 Markdown 标题语法（# ## ###）构建层级</span>
              <button
                type="button"
                class="rte-mindmap-modal-btn-icon"
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
                class="rte-mindmap-modal-btn-icon"
                @click="cancelEdit"
                title="关闭"
              >&times;</button>
            </div>
          </div>
          <div class="rte-mindmap-modal-body">
            <!-- Markdown editor (left) -->
            <div class="rte-mindmap-modal-editor">
              <div class="rte-mindmap-modal-label">Markdown</div>
              <textarea
                v-model="editCode"
                class="rte-mindmap-textarea"
                spellcheck="false"
                @input="onEditInput"
                @keydown="onTextareaKeydown"
                placeholder="# 核心主题&#10;## 分支一&#10;### 子主题 A&#10;## 分支二"
              ></textarea>
            </div>
            <!-- Live preview (right) -->
            <div class="rte-mindmap-modal-preview-panel">
              <div class="rte-mindmap-modal-label">实时预览</div>
              <div class="rte-mindmap-modal-preview">
                <svg ref="previewSvgEl" class="rte-mindmap-preview-svg" />
              </div>
            </div>
          </div>
          <div class="rte-mindmap-modal-footer">
            <div class="rte-mindmap-modal-templates-scroll">
              <div class="rte-mindmap-modal-templates">
                <span class="rte-mindmap-templates-label">模板：</span>
                <button
                  v-for="tpl in templates"
                  :key="tpl.label"
                  type="button"
                  class="rte-mindmap-template-btn"
                  @click="applyTemplate(tpl.code)"
                >{{ tpl.label }}</button>
              </div>
            </div>
            <div class="rte-mindmap-modal-actions">
              <button type="button" class="rte-mindmap-btn rte-mindmap-btn-cancel" @click="cancelEdit">取消</button>
              <button type="button" class="rte-mindmap-btn rte-mindmap-btn-save" @click="saveEdit">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="删除思维导图"
      message="确定要删除此思维导图吗？此操作不可恢复。"
      confirm-text="删除"
      type="danger"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />
  </NodeViewWrapper>
</template>

<style scoped>
/* ---- Block wrapper ---- */
.rte-mindmap-block {
  position: relative;
  margin: 12px 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--color-surface, #ffffff);
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: default;
  overflow: hidden;
  min-height: 200px;
}
.rte-mindmap-block.rte-mindmap-resizing {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
  transition: none;
}
.rte-mindmap-block:hover {
  border-color: var(--color-border-light, #e5e7eb);
  box-shadow: 0 0 0 1px var(--color-border-light, #e5e7eb);
}

/* ---- SVG viewport ---- */
.rte-mindmap-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}
.rte-mindmap-svg:active {
  cursor: grabbing;
}

/* ---- Toolbar ---- */
.rte-mindmap-toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  z-index: 10;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 6px;
  padding: 2px 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.rte-mindmap-toolbar-btn {
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
.rte-mindmap-toolbar-btn:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #1f2937);
}
.rte-mindmap-toolbar-btn-danger:hover {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}
.rte-mindmap-toolbar-sep {
  width: 1px;
  background: var(--color-border-light, #e5e7eb);
  margin: 3px 2px;
}

/* ---- Loading ---- */
.rte-mindmap-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-3, #9ca3af);
  font-size: 13px;
}
.rte-mindmap-spinner {
  animation: rte-mindmap-spin 1s linear infinite;
}
@keyframes rte-mindmap-spin {
  to { transform: rotate(360deg); }
}

/* ---- Error ---- */
.rte-mindmap-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rte-mindmap-error-icon { font-size: 24px; }
.rte-mindmap-error-msg {
  font-size: 12px;
  color: var(--color-danger, #ef4444);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  max-width: 90%;
  text-align: center;
  word-break: break-all;
}
.rte-mindmap-error-btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-surface, #fff);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-2, #4b5563);
}

/* ---- Resize handle ---- */
.rte-mindmap-resize-handle {
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
.rte-mindmap-resize-handle:hover {
  opacity: 1;
  color: var(--color-primary, #3b82f6);
}

/* ---- Modal ---- */
.rte-mindmap-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.rte-mindmap-modal {
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
.rte-mindmap-modal-maximized {
  position: fixed;
  inset: 0;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none;
  max-height: none;
  border-radius: 0;
}

/* Modal header */
.rte-mindmap-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  flex-shrink: 0;
}
.rte-mindmap-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1, #1f2937);
}
.rte-mindmap-modal-title {
  display: flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
}
.rte-mindmap-title-icon {
  flex-shrink: 0;
  margin-right: 6px;
}
.rte-mindmap-modal-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rte-mindmap-modal-hint {
  font-size: 12px;
  color: var(--color-text-4, #9ca3af);
}
.rte-mindmap-modal-btn-icon {
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
.rte-mindmap-modal-btn-icon:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #1f2937);
}

/* Modal body */
.rte-mindmap-modal-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.rte-mindmap-modal-editor,
.rte-mindmap-modal-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rte-mindmap-modal-editor {
  border-right: 1px solid var(--color-border-light, #e5e7eb);
}
.rte-mindmap-modal-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3, #6b7280);
  padding: 8px 16px 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.rte-mindmap-textarea {
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
.rte-mindmap-modal-preview {
  flex: 1;
  overflow: hidden;
  background: var(--color-bg-1, #f9fafb);
}
.rte-mindmap-preview-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Modal footer */
.rte-mindmap-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  flex-shrink: 0;
  gap: 12px;
}
.rte-mindmap-modal-templates-scroll {
  flex: 1;
  overflow-x: auto;
  min-width: 0;
}
.rte-mindmap-modal-templates {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}
.rte-mindmap-templates-label {
  font-size: 12px;
  color: var(--color-text-3, #6b7280);
  white-space: nowrap;
  flex-shrink: 0;
}
.rte-mindmap-template-btn {
  padding: 3px 10px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-surface, #fff);
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-2, #4b5563);
  transition: all 0.15s;
  white-space: nowrap;
}
.rte-mindmap-template-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}
.rte-mindmap-modal-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.rte-mindmap-btn {
  padding: 6px 18px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.rte-mindmap-btn-cancel {
  background: transparent;
  border-color: var(--color-border-light, #e5e7eb);
  color: var(--color-text-2, #4b5563);
}
.rte-mindmap-btn-cancel:hover {
  background: var(--color-bg-3, #f3f4f6);
}
.rte-mindmap-btn-save {
  background: var(--color-primary, #3b82f6);
  color: #ffffff;
}
.rte-mindmap-btn-save:hover {
  filter: brightness(1.1);
}
</style>
