/**
 * Slash command (`/`) trigger for the rich text editor.
 *
 * Detects `/` typed at block-start position and opens a command picker panel.
 * Pure ProseMirror handleTextInput + native DOM panel — zero dependency on
 * @tiptap/suggestion or @tiptap/extension-mention.
 *
 * v3 fixes:
 * - keydown: capture phase + stopImmediatePropagation → Enter works before PM
 * - mouseenter: CSS-only highlight, no DOM rebuild → click events preserved
 * - mousedown: event delegation on panel container → robust click handling
 * - onSelect: apply block type first, close panel after → editor state intact
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

// ---- Types -------------------------------------------------------------------

export interface SlashItem {
  type: string
  label: string
  icon: string
  desc: string
  category: string
}

export const SLASH_ITEMS: SlashItem[] = [
  { type: 'text',      label: '文本',     icon: '¶',  desc: '普通段落',       category: '基础块' },
  { type: 'h1',        label: '一级标题', icon: 'H1', desc: '大标题',         category: '基础块' },
  { type: 'h2',        label: '二级标题', icon: 'H2', desc: '中等标题',       category: '基础块' },
  { type: 'h3',        label: '三级标题', icon: 'H3', desc: '小标题',         category: '基础块' },
  { type: 'bullet',    label: '无序列表', icon: '•',  desc: '项目符号列表',   category: '列表' },
  { type: 'ordered',   label: '有序列表', icon: '1.', desc: '编号列表',       category: '列表' },
  { type: 'taskList',  label: '待办清单', icon: '☑',  desc: '可勾选的清单',   category: '列表' },
  { type: 'quote',     label: '引用块',   icon: '❝',  desc: '引用/摘录',     category: '高级块' },
  { type: 'callout',   label: '提示块',   icon: '💡', desc: '带图标的提示框', category: '高级块' },
  { type: 'toggle',    label: '折叠块',   icon: '▶',  desc: '可折叠的内容块', category: '高级块' },
  { type: 'hr',        label: '分割线',   icon: '─',  desc: '水平分隔线',     category: '高级块' },
  { type: 'codeBlock', label: '代码块',   icon: '<>', desc: '代码块',         category: '高级块' },
  { type: 'table',     label: '表格',     icon: '▦',  desc: '3×3 简单表格',   category: '高级块' },
  { type: 'mermaid',   label: 'Mermaid 图表', icon: '📊', desc: '流程图/时序图/甘特图', category: '高级块' },
  { type: 'mindmap',   label: '思维导图',   icon: '🧠', desc: 'XMind 风格思维导图', category: '高级块' },
  { type: 'memoLink',  label: '链接备忘', icon: '[[', desc: '引用另一条备忘录',   category: '嵌入' },
]

export const slashCommandPluginKey = new PluginKey('slashCommand')

// ---- Module-level state -----------------------------------------------------

let _editor: any = null
let _view: EditorView | null = null
let _range: { from: number; to: number } | null = null
let _keydownHandler: ((e: KeyboardEvent) => void) | null = null
let _docMouseHandler: ((e: MouseEvent) => void) | null = null
let _panelMouseHandler: ((e: MouseEvent) => void) | null = null
let _selectedIdx = 0
let _query = ''   // Search query typed after '/'
let _trackRAF: number | null = null  // RAF handle for query tracking
let _panel: HTMLElement | null = null  // The panel DOM element

// ---- Helpers -----------------------------------------------------------------

function getFilteredIndices(query: string): number[] {
  if (!query) return SLASH_ITEMS.map((_, i) => i)
  const q = query.toLowerCase()
  return SLASH_ITEMS
    .map((item, i) => ({ item, i }))
    .filter(({ item }) =>
      item.label.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    )
    .map(({ i }) => i)
}

function closePanel() {
  // Cancel RAF tracking
  if (_trackRAF) {
    cancelAnimationFrame(_trackRAF)
    _trackRAF = null
  }

  // Clean up document-level listeners
  if (_docMouseHandler) {
    document.removeEventListener('mousedown', _docMouseHandler, true)
    _docMouseHandler = null
  }
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler, true)
    _keydownHandler = null
  }

  const el = document.querySelector('.rte-slash-panel') as HTMLElement | null
  if ((el as any)?.__cleanup) (el as any).__cleanup()
  _panel = null
  _view = null
  _range = null
  _editor = null
  _selectedIdx = 0
  _query = ''
}

function startTracking() {
  if (_trackRAF) cancelAnimationFrame(_trackRAF)

  let lastQuery = _query

  function tick() {
    if (!_view || !_range) return

    const { from } = _view.state.selection
    const queryStart = _range.from + 1

    // Cursor moved before '/' → close panel
    if (from < queryStart) {
      closePanel()
      return
    }

    // Read query from document (text between '/' and cursor)
    const newQuery = _view.state.doc.textBetween(queryStart, from, ' ')

    if (newQuery !== lastQuery) {
      lastQuery = newQuery
      _query = newQuery
      renderPanel()
    }

    _trackRAF = requestAnimationFrame(tick)
  }

  _trackRAF = requestAnimationFrame(tick)
}

// ---- Highlight helper (CSS-only, no DOM rebuild) ----------------------------

function updateHighlight() {
  if (!_panel) return
  const items = _panel.querySelectorAll<HTMLElement>('[data-slash-idx]')
  items.forEach((el, i) => {
    el.style.background = i === _selectedIdx ? 'var(--color-bg-3, #e5e7eb)' : 'transparent'
  })
}

// ---- Panel rendering ----------------------------------------------------------

function renderPanel() {
  if (!_panel || !_view || !_range) return

  _panel.innerHTML = ''

  const indices = getFilteredIndices(_query)

  if (indices.length === 0) {
    const empty = document.createElement('div')
    empty.textContent = '没有匹配的结果'
    Object.assign(empty.style, {
      padding: '16px',
      textAlign: 'center',
      fontSize: '13px',
      color: 'var(--color-text-4, #9ca3af)',
    })
    _panel.appendChild(empty)
    return
  }

  let lastCat = ''
  let renderedCount = 0

  for (const idx of indices) {
    const item = SLASH_ITEMS[idx]

    // Category separator
    if (item.category !== lastCat) {
      lastCat = item.category
      const sep = document.createElement('div')
      sep.textContent = lastCat
      Object.assign(sep.style, {
        padding: '7px 12px 3px',
        fontSize: '10px',
        fontWeight: '700',
        color: 'var(--color-text-4, #9ca3af)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      })
      _panel.appendChild(sep)
    }

    const el = document.createElement('div')
    el.setAttribute('data-slash-idx', String(idx))
    el.setAttribute('data-rendered-idx', String(renderedCount))
    const active = renderedCount === _selectedIdx
    // R2-S05: Use DOM API + textContent instead of innerHTML to prevent XSS
    const iconSpan = document.createElement('span')
    iconSpan.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0;border-radius:6px;font-size:14px;background:var(--color-bg-2,#f3f4f6);margin-right:10px'
    iconSpan.textContent = item.icon
    const labelSpan = document.createElement('span')
    labelSpan.style.cssText = 'font-weight:600;font-size:13px;color:var(--color-text-1,#1f2937);flex:1'
    labelSpan.textContent = item.label
    const descSpan = document.createElement('span')
    descSpan.style.cssText = 'font-size:11px;color:var(--color-text-4,#9ca3af);margin-left:12px;white-space:nowrap'
    descSpan.textContent = item.desc
    el.appendChild(iconSpan)
    el.appendChild(labelSpan)
    el.appendChild(descSpan)
    Object.assign(el.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '6px 10px',
      borderRadius: '6px',
      cursor: 'pointer',
      margin: '1px 2px',
      background: active ? 'var(--color-bg-3, #e5e7eb)' : 'transparent',
      transition: 'background 0.1s',
    })
    // CSS-only highlight on hover — NO re-render
    el.addEventListener('mouseenter', () => {
      _selectedIdx = renderedCount
      updateHighlight()
    })
    _panel.appendChild(el)
    renderedCount++
  }
}

// ---- Selection handler --------------------------------------------------------

function onSelect(idx: number) {
  // Save references BEFORE any state changes
  const ed = _editor
  const r = _range
  const view = _view

  if (!ed || !r || !view) {
    closePanel()
    return
  }

  const item = SLASH_ITEMS[idx]
  if (!item) {
    closePanel()
    return
  }

  // Read cursor position from the live view state
  const cursorPos = view.state.selection.from

  // Apply block type FIRST (while editor state is intact), then close panel
  const chain = ed.chain().focus().deleteRange({ from: r.from, to: cursorPos })
  switch (item.type) {
    case 'text':     chain.setParagraph(); break
    case 'h1':       chain.toggleHeading({ level: 1 }); break
    case 'h2':       chain.toggleHeading({ level: 2 }); break
    case 'h3':       chain.toggleHeading({ level: 3 }); break
    case 'bullet':   chain.toggleBulletList(); break
    case 'ordered':  chain.toggleOrderedList(); break
    case 'taskList': chain.toggleTaskList(); break
    case 'quote':    chain.toggleBlockquote(); break
    case 'callout':  chain.setCallout(); break
    case 'toggle':   chain.setToggle(); break
    case 'hr':       chain.setHorizontalRule(); break
    case 'codeBlock': chain.toggleCodeBlock(); break
    case 'table':    chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }); break
    case 'mermaid':  chain.insertMermaid(); break
    case 'mindmap':  chain.insertMindmap(); break
    case 'memoLink': chain.insertContent('[['); break
  }
  chain.run()

  // Now safe to close
  closePanel()
}

// ---- Panel show ---------------------------------------------------------------

function showPanel(view: EditorView, editor: any, pos: number) {
  closePanel()
  _editor = editor
  _view = view
  _range = { from: Math.max(0, pos - 1), to: pos }
  _selectedIdx = 0
  _query = ''

  const panel = document.createElement('div')
  panel.className = 'rte-slash-panel'
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '9999',
    background: 'var(--color-surface, #fff)',
    border: '1px solid var(--color-border-light, #e5e7eb)',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    padding: '6px 4px',
    minWidth: '260px',
    maxWidth: '320px',
    maxHeight: '340px',
    overflowY: 'auto',
    fontSize: '13px',
    fontFamily: 'inherit',
  })

  // Position below cursor
  try {
    const safePos = Math.min(pos, Math.max(0, view.state.doc.content.size - 1))
    const coords = view.coordsAtPos(safePos)
    let top = coords.bottom + 6
    let left = coords.left
    if (top + 340 > window.innerHeight - 16) top = coords.top - 340 - 6
    if (left + 260 > window.innerWidth - 16) left = window.innerWidth - 260 - 16
    panel.style.top = `${Math.max(8, top)}px`
    panel.style.left = `${Math.max(8, left)}px`
  } catch {
    panel.style.top = '30%'
    panel.style.left = '30%'
  }

  // ---- Panel-level mousedown: event delegation for item clicks ----
  _panelMouseHandler = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const itemEl = target.closest('[data-slash-idx]') as HTMLElement | null
    if (itemEl) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const idx = parseInt(itemEl.getAttribute('data-slash-idx')!, 10)
      onSelect(idx)
    }
  }
  panel.addEventListener('mousedown', _panelMouseHandler)

  // ---- Document-level mousedown: close on outside click (CAPTURE phase) ----
  _docMouseHandler = (e: MouseEvent) => {
    if (!_view) return
    const target = e.target
    if (!(target instanceof Element)) return
    // If click is inside the panel, let the panel handler deal with it
    if (target.closest('.rte-slash-panel')) return
    // Outside click → close
    closePanel()
  }
  document.addEventListener('mousedown', _docMouseHandler, true)

  // ---- KeyDown handler (CAPTURE phase — fires BEFORE ProseMirror) ----
  _keydownHandler = (e: KeyboardEvent) => {
    if (!_view || !_range) return

    // Only intercept navigation keys when panel is open
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') return

    const total = getFilteredIndices(_query).length
    if (!total && e.key !== 'Escape') return

    // Stop the event from reaching ProseMirror
    e.preventDefault()
    e.stopImmediatePropagation()

    if (e.key === 'ArrowDown') {
      _selectedIdx = (_selectedIdx + 1) % total
      updateHighlight()
      // Scroll selected item into view
      scrollSelectedIntoView()
    } else if (e.key === 'ArrowUp') {
      _selectedIdx = (_selectedIdx - 1 + total) % total
      updateHighlight()
      scrollSelectedIntoView()
    } else if (e.key === 'Enter') {
      const indices = getFilteredIndices(_query)
      if (indices[_selectedIdx] !== undefined) onSelect(indices[_selectedIdx])
    } else if (e.key === 'Escape') {
      closePanel()
      view.focus()
    }
  }
  // CAPTURE phase: our handler fires BEFORE the event reaches the editor
  document.addEventListener('keydown', _keydownHandler, true)

  ;(panel as any).__cleanup = () => {
    if (_panelMouseHandler) panel.removeEventListener('mousedown', _panelMouseHandler)
    _panelMouseHandler = null
    panel.remove()
  }

  _panel = panel
  startTracking()
  renderPanel()
  document.body.appendChild(panel)
}

// ---- Scroll helper -----------------------------------------------------------

function scrollSelectedIntoView() {
  if (!_panel) return
  const items = _panel.querySelectorAll<HTMLElement>('[data-rendered-idx]')
  const el = items[_selectedIdx]
  if (el) {
    el.scrollIntoView({ block: 'nearest' })
  }
}

// ---- Public API -------------------------------------------------------------

/** Programmatically open the slash command panel at the current cursor position. */
export function openSlashPanel(editor: any) {
  if (!editor?.view) return
  const view: EditorView = editor.view
  const { from } = editor.state.selection
  // Insert '/' at cursor and show panel
  const tr = view.state.tr.insertText('/', from)
  view.dispatch(tr)
  showPanel(view, editor, from + 1)
}

// ---- Extension --------------------------------------------------------------

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    // Capture `this.editor` (Tiptap Editor instance) in a closure
    const editor = this.editor

    return [
      new Plugin({
        key: slashCommandPluginKey,
        props: {
          handleTextInput(view: EditorView, from: number, _to: number, text: string): boolean {
            if (text !== '/') return false
            const $pos = view.state.doc.resolve(from)
            if ($pos.parentOffset !== 0) return false
            showPanel(view, editor, from + 1)
            return false
          },
          handleClick(_view: EditorView, _pos: number, event: MouseEvent) {
            const t = event.target
            if (!(t instanceof Element) || !t.closest('.rte-slash-panel')) closePanel()
            return false
          },
        },
      }),
    ]
  },
})
