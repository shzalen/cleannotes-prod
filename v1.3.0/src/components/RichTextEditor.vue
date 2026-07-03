<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Blockquote from '@tiptap/extension-blockquote'
import CodeBlock from '@tiptap/extension-code-block'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableMap } from '@tiptap/pm/tables'
import { ImageResize } from 'tiptap-extension-resize-image'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { FileAttachment } from '@/extensions/FileAttachmentExtension'
import { SlashCommand, openSlashPanel } from '@/extensions/SlashCommand'
import { MarkdownInputRules } from '@/extensions/MarkdownInputRules'
import { Callout } from '@/extensions/CalloutExtension'
import { Toggle } from '@/extensions/ToggleExtension'
import { DoubleBracketLinker } from '@/extensions/DoubleBracketLinker'
import { TrailingNode } from '@/extensions/TrailingNode'
import { EmojiExtension } from '@/extensions/EmojiExtension'
import { Mermaid } from '@/extensions/MermaidExtension'
import { Mindmap } from '@/extensions/MindmapExtension'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

/** Max file size for embed: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'mention-click': [memoId: string]
  'headings-change': [headings: { level: number; text: string; index: number }[]]
  'image-lightbox': [src: string]
}>()

// ---- Refs ----
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const rteWrapperRef = ref<HTMLDivElement | null>(null)
const bubbleRef = ref<HTMLDivElement | null>(null)
const pendingUploadType = ref<'image' | 'file'>('image')

// ---- Bubble menu state ----
const bubbleVisible = ref(false)
const bubbleCoords = ref({ top: 0, left: 0 })
const bubbleSelection = ref<{ from: number; to: number } | null>(null)

// ---- Picker state ----
const showColorPicker = ref(false)
const colorPickerCoords = ref({ top: 0, left: 0 })
const showAlignPicker = ref(false)
const alignPickerCoords = ref({ top: 0, left: 0 })
const showTurnInto = ref(false)
const turnIntoCoords = ref({ top: 0, left: 0 })

// ---- Table controls state ----
// Notion-style controls: triggers live OUTSIDE cells (on row/column borders),
// so they never block typing inside a cell.
const showTableControls = ref(false)
const tableMenuMode = ref<'row' | 'col' | 'table'>('row')
const tableColorScope = ref<'cell' | 'row' | 'col'>('row')
const hoveredRowPos = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const hoveredColPos = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const tableBottomPos = ref<{ top: number; left: number; width: number } | null>(null)
const tableMenuPos = ref({ top: 0, left: 0 })
const showTableMenu = ref(false)
const showTableColorSubmenu = ref(false)
const tableColorSubmenuPos = ref({ top: 0, left: 0 })
const savedTableSelection = ref<{ from: number; to: number } | null>(null)

// ---- Table delete confirmation state ----
const tableConfirmVisible = ref(false)
const tableConfirmTitle = ref('确认操作')
const tableConfirmMessage = ref('')
const pendingTableAction = ref<string | null>(null)

// ---- Image toolbar state ----
const imageToolbarVisible = ref(false)
const imageToolbarCoords = ref({ top: 0, left: 0 })
const selectedImageRect = ref<DOMRect | null>(null)
const IMAGE_WIDTH_PRESETS = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
  { label: '原图', value: 'auto' },
]

// ---- Batch add-row drag state ----
interface AddRowDragState {
  startY: number
  addedCount: number
  rowHeight: number
}
const addRowDrag = ref<AddRowDragState | null>(null)
const addRowDragCount = ref(0)
const addRowDragPos = ref({ top: 0, left: 0 })

// ---- Helpers ----
function extractHeadings(json: any): { level: number; text: string; index: number }[] {
  const headings: { level: number; text: string; index: number }[] = []
  let index = 0
  function walk(node: any) {
    if (node.type === 'heading' && [1, 2, 3].includes(node.attrs?.level)) {
      const text = node.content?.map((c: any) => c.text || '').join('') || ''
      headings.push({ level: node.attrs.level, text, index: index++ })
    }
    if (node.content) node.content.forEach(walk)
  }
  if (json?.content) json.content.forEach(walk)
  return headings
}

// (slash panel now rendered by SlashCommand extension via native DOM)

// ---- Bubble menu ----
function showBubble(e: MouseEvent) {
  if (!editor.value) return
  // Don't show the bubble menu when the cursor/selection is inside a table,
  // otherwise it overlaps the table controls (⋮⋮ button + dropdown).
  if (editor.value.isActive('table')) {
    hideBubble()
    return
  }
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !rteWrapperRef.value?.contains(sel.anchorNode)) {
    hideBubble()
    return
  }
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0) {
    hideBubble()
    return
  }
  bubbleCoords.value = { top: rect.top - 44, left: rect.left + rect.width / 2 }
  bubbleVisible.value = true
  bubbleSelection.value = { from: editor.value.state.selection.from, to: editor.value.state.selection.to }
}

function hideBubble() {
  bubbleVisible.value = false
  bubbleSelection.value = null
}

function bubbleIsActive(type: string) {
  if (!editor.value) return false
  switch (type) {
    case 'bold':
      return editor.value.isActive('bold')
    case 'italic':
      return editor.value.isActive('italic')
    case 'strike':
      return editor.value.isActive('strike')
    case 'underline':
      return editor.value.isActive('underline')
    case 'link':
      return editor.value.isActive('link')
    case 'highlight':
      return editor.value.isActive('highlight')
    default:
      return false
  }
}

function bubbleToggle(type: string) {
  if (!editor.value) return
  const chain = editor.value.chain().focus()
  switch (type) {
    case 'bold':
      chain.toggleBold().run()
      break
    case 'italic':
      chain.toggleItalic().run()
      break
    case 'strike':
      chain.toggleStrike().run()
      break
    case 'underline':
      chain.toggleUnderline().run()
      break
    case 'link':
      const url = window.prompt('输入链接地址:')
      if (url) chain.extendMarkRange('link').setLink({ href: url }).run()
      break
    case 'highlight':
      if (editor.value.isActive('highlight')) {
        chain.unsetHighlight().run()
      } else {
        chain.setHighlight({ color: '#fef08a' }).run()
      }
      break
    case 'align-left':
      chain.setTextAlign('left').run()
      break
    case 'align-center':
      chain.setTextAlign('center').run()
      break
    case 'align-right':
      chain.setTextAlign('right').run()
      break
    case 'align-justify':
      chain.setTextAlign('justify').run()
      break
  }
  nextTick(() => showBubble(new MouseEvent('mouseup')))
}

// ---- Color & Alignment pickers ----
const TEXT_COLORS = [
  '#111827', '#ef4444', '#f97316', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#eab308', '#ffffff', '#000000',
]

const TABLE_BG_COLORS = [
  '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#e5e7eb',
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#9ca3af',
]

function openColorPicker(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  colorPickerCoords.value = { top: rect.bottom + 6, left: rect.left }
  showColorPicker.value = true
  showAlignPicker.value = false
}

function applyColor(color: string | null) {
  if (!editor.value) return
  const chain = editor.value.chain().focus()
  if (color) {
    chain.setColor(color)
  } else {
    chain.unsetColor()
  }
  chain.run()
  showColorPicker.value = false
  nextTick(() => showBubble(new MouseEvent('mouseup')))
}

function openAlignPicker(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  alignPickerCoords.value = { top: rect.bottom + 6, left: rect.left }
  showAlignPicker.value = true
  showColorPicker.value = false
}

function applyAlign(align: 'left' | 'center' | 'right' | 'justify') {
  editor.value?.chain().focus().setTextAlign(align).run()
  showAlignPicker.value = false
  nextTick(() => showBubble(new MouseEvent('mouseup')))
}

function closePickers() {
  showColorPicker.value = false
  showAlignPicker.value = false
  showTurnInto.value = false
  showTableMenu.value = false
  showTableColorSubmenu.value = false
}

// ---- Table controls (Notion-style ⋮⋮ button + dropdown) ----
function showTableControlsFor(cellEl: HTMLElement) {
  const cellRect = cellEl.getBoundingClientRect()
  const tableEl = cellEl.closest('table') as HTMLElement | null
  const rowEl = cellEl.closest('tr') as HTMLElement | null
  if (!tableEl || !rowEl) return

  const tableRect = tableEl.getBoundingClientRect()
  const rowRect = rowEl.getBoundingClientRect()

  // Compute the hovered column's bounding rect by scanning row cells.
  const cells = Array.from(rowEl.querySelectorAll('td, th'))
  const colIndex = cells.indexOf(cellEl)
  let colLeft = tableRect.left
  let colWidth = cellRect.width
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] as HTMLElement
    const r = c.getBoundingClientRect()
    if (i === colIndex) {
      colLeft = r.left
      colWidth = r.width
      break
    }
  }

  hoveredRowPos.value = {
    top: rowRect.top,
    left: rowRect.left,
    width: rowRect.width,
    height: rowRect.height,
  }
  hoveredColPos.value = {
    top: tableRect.top,
    left: colLeft,
    width: colWidth,
    height: tableRect.height,
  }
  tableBottomPos.value = {
    top: tableRect.bottom,
    left: tableRect.left,
    width: tableRect.width,
  }

  hideBubble()
  if (!showTableControls.value) {
    showTableControls.value = true
  }
}

function updateTableControls() {
  if (!editor.value) {
    showTableControls.value = false
    showTableMenu.value = false
    return
  }
  const { state } = editor.value
  const { selection } = state
  // Check if selection is inside a table
  const $pos = state.doc.resolve(selection.from)
  let node = $pos.node($pos.depth)
  let tableDepth = $pos.depth
  // Walk up to find table node
  while (node && node.type.name !== 'table' && tableDepth > 0) {
    tableDepth--
    node = $pos.node(tableDepth)
  }
  if (!node || node.type.name !== 'table') {
    // Keep the controls visible while the user is interacting with the menu
    // so that clicking the trigger/menu doesn't immediately hide everything.
    if (!showTableMenu.value) {
      showTableControls.value = false
      savedTableSelection.value = null
    }
    updateActiveCellClass(null)
    return
  }
  // Save current selection so we can restore it after clicking menu items
  savedTableSelection.value = { from: selection.from, to: selection.to }
  // Find the table cell (td/th) that contains the current selection
  const domAtPos = editor.value.view.domAtPos(selection.from)
  let targetNode: Node = domAtPos.node
  // domAtPos may return a text node; closest() only works on Elements
  if (targetNode.nodeType === Node.TEXT_NODE && targetNode.parentElement) {
    targetNode = targetNode.parentElement
  }
  const cellEl = (targetNode as HTMLElement).closest('td, th')
  if (!cellEl) {
    if (!showTableMenu.value) {
      showTableControls.value = false
    }
    updateActiveCellClass(null)
    return
  }
  showTableControlsFor(cellEl as HTMLElement)
  updateActiveCellClass(cellEl as HTMLElement)
}

// Highlight the currently selected table cell by adding a colored border
// class. This is cleared whenever the cursor leaves a table.
function updateActiveCellClass(cellEl: HTMLElement | null) {
  if (!rteWrapperRef.value) return
  const wrapper = rteWrapperRef.value
  const prev = wrapper.querySelectorAll('.rte-active-cell')
  prev.forEach((el) => el.classList.remove('rte-active-cell'))
  if (cellEl && wrapper.contains(cellEl)) {
    cellEl.classList.add('rte-active-cell')
  }
}

// Show table controls when the mouse hovers over a table cell. We listen on the
// document so we can also detect when the cursor moves onto the floating
// trigger button (which is teleported to <body> and therefore outside the
// editor wrapper). Without this, leaving the editor for the button would
// immediately hide the button before the user can click it.
function onDocumentMouseMove(e: MouseEvent) {
  if (!editor.value || showTableMenu.value) return
  const target = e.target as HTMLElement
  // Keep controls visible while the cursor is over the trigger/menu itself.
  if (target.closest('.rte-table-controls-wrapper')) {
    return
  }
  // Position the button at the top-left of the currently hovered cell.
  const cell = target.closest('td, th') as HTMLElement | null
  if (cell && rteWrapperRef.value?.contains(cell)) {
    try {
      const pos = editor.value.view.posAtDOM(cell, 0)
      // Use the position inside the cell so row/column commands operate on the
      // cell under the mouse, not on the old text cursor location.
      savedTableSelection.value = { from: pos, to: pos }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[RichTextEditor] posAtDOM failed:', err)
    }
    showTableControlsFor(cell)
    return
  }
  // Cursor is neither over a table cell nor over the controls: hide the button.
  showTableControls.value = false
}

// Position the dropdown so it stays inside the viewport. If the menu would
// overflow the bottom, flip it above the trigger; clamp left/right edges too.
function positionTableMenu() {
  if (!showTableControls.value) return
  const vw = window.innerWidth
  const vh = window.innerHeight
  const estimatedWidth = 200
  const estimatedHeight = 340

  let anchorTop = 0
  let anchorLeft = 0

  switch (tableMenuMode.value) {
    case 'row':
      if (hoveredRowPos.value) {
        anchorTop = hoveredRowPos.value.top + hoveredRowPos.value.height / 2
        anchorLeft = hoveredRowPos.value.left
      }
      break
    case 'col':
      if (hoveredColPos.value) {
        anchorTop = hoveredColPos.value.top
        anchorLeft = hoveredColPos.value.left + hoveredColPos.value.width / 2
      }
      break
    case 'table':
      if (tableBottomPos.value) {
        anchorTop = tableBottomPos.value.top
        anchorLeft = tableBottomPos.value.left + tableBottomPos.value.width / 2
      }
      break
  }

  // Default: show below the anchor, horizontally centered.
  let top = anchorTop + 8
  let left = anchorLeft - estimatedWidth / 2

  // Flip above if it would overflow the bottom
  if (top + estimatedHeight > vh - 8) {
    top = anchorTop - estimatedHeight - 8
  }
  // Clamp to viewport
  if (top < 8) top = 8
  if (left + estimatedWidth > vw - 8) left = vw - estimatedWidth - 8
  if (left < 8) left = 8

  tableMenuPos.value = { top, left }

  // Fine-tune after render using the actual menu dimensions
  nextTick(() => {
    const el = document.querySelector('.rte-table-menu') as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    let t = rect.top
    let l = rect.left
    if (t + rect.height > vh - 8) t = vh - rect.height - 8
    if (t < 8) t = 8
    if (l + rect.width > vw - 8) l = vw - rect.width - 8
    if (l < 8) l = 8
    if (t !== rect.top || l !== rect.left) {
      tableMenuPos.value = { top: t, left: l }
    }
  })
}

function toggleTableMenu(mode: 'row' | 'col' | 'table') {
  if (showTableMenu.value && tableMenuMode.value === mode) {
    showTableMenu.value = false
    showTableColorSubmenu.value = false
  } else {
    tableMenuMode.value = mode
    // Default color scope matches the current menu (row/col); cell is also available via toggle.
    if (mode === 'row' || mode === 'col') {
      tableColorScope.value = mode
    }
    // The target cell was already recorded while hovering (onDocumentMouseMove)
    // and via onSelectionUpdate, so menu commands operate on the correct row/column.
    showTableMenu.value = true
    showTableColorSubmenu.value = false
    positionTableMenu()
  }
}

function applyTableColor(color: string | null) {
  if (!editor.value || !savedTableSelection.value) {
    console.warn('[RichTextEditor] applyTableColor: no editor/selection')
    return
  }

  const ed = editor.value
  const { state } = ed
  const $pos = state.doc.resolve(savedTableSelection.value.from)

  // Walk up the resolved position to find the containing table and cell.
  let tableDepth = -1
  let cellDepth = -1
  for (let d = $pos.depth; d >= 0; d--) {
    const name = $pos.node(d).type.name
    if (name === 'table' && tableDepth === -1) tableDepth = d
    if ((name === 'tableCell' || name === 'tableHeader') && cellDepth === -1) cellDepth = d
  }
  if (tableDepth === -1 || cellDepth === -1) {
    console.warn('[RichTextEditor] applyTableColor: not inside a table cell')
    return
  }

  // TableMap positions are relative to the table content start (tableStart + 1),
  // not the table node start. Using $pos.start(tableDepth) aligns the cell offset
  // with the values stored in the map.
  const tableStart = $pos.start(tableDepth)
  const tableNode = $pos.node(tableDepth)
  const map = TableMap.get(tableNode)
  const cellPos = $pos.before(cellDepth) - tableStart
  const rect = map.findCell(cellPos)

  const scope = tableColorScope.value
  const targetRect =
    scope === 'row'
      ? { left: 0, top: rect.top, right: map.width, bottom: rect.bottom }
      : scope === 'col'
      ? { left: rect.left, top: 0, right: rect.right, bottom: map.height }
      : rect

  const cells = map.cellsInRect(targetRect)
  if (!cells.length) {
    console.warn('[RichTextEditor] applyTableColor: no cells in target rect')
    return
  }

  // Apply the color by directly updating each cell's node markup. This is
  // more reliable than Tiptap's setCellAttribute command because it doesn't
  // depend on a CellSelection or command chain.
  let tr = state.tr
  cells.forEach((offset) => {
    const pos = tableStart + offset
    const node = tr.doc.nodeAt(pos)
    if (!node || (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader')) return
    const attrs = { ...node.attrs, backgroundColor: color }
    tr = tr.setNodeMarkup(pos, undefined, attrs)
  })
  // Preserve the original text selection so the cursor doesn't jump around.
  tr.setSelection(state.selection.map(tr.doc, tr.mapping))
  ed.view.dispatch(tr)
  ed.commands.focus()

  showTableColorSubmenu.value = false
  showTableMenu.value = false
}

function openTableColorSubmenu(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const submenuWidth = 172
  const submenuHeight = 260
  let left = rect.right + 6
  if (left + submenuWidth > window.innerWidth - 8) {
    left = rect.left - submenuWidth - 6
  }
  let top = rect.top
  if (top + submenuHeight > window.innerHeight - 8) {
    top = window.innerHeight - submenuHeight - 8
  }
  if (top < 8) top = 8
  tableColorSubmenuPos.value = { top, left }
  showTableColorSubmenu.value = true
}

// Table operation commands
function tableAction(action: string) {
  if (!editor.value) return

  // Close the menu immediately so it doesn't stay open if the command fails.
  showTableMenu.value = false

  // Build a single chain: restore focus + selection, then run the table command.
  // This guarantees that the table command sees the freshly restored selection.
  const saved = savedTableSelection.value
  const { selection } = editor.value.state
  const target = saved ?? { from: selection.from, to: selection.to }
  let chain = editor.value
    .chain()
    .focus()
    .setTextSelection(target)

  switch (action) {
    case 'addRowBefore': chain = chain.addRowBefore(); break
    case 'addRowAfter': chain = chain.addRowAfter(); break
    case 'addColumnBefore': chain = chain.addColumnBefore(); break
    case 'addColumnAfter': chain = chain.addColumnAfter(); break
    case 'deleteRow': chain = chain.deleteRow(); break
    case 'deleteColumn': chain = chain.deleteColumn(); break
    case 'deleteTable': chain = chain.deleteTable(); break
    case 'toggleHeaderRow': chain = chain.toggleHeaderRow(); break
    case 'toggleHeaderColumn': chain = chain.toggleHeaderColumn(); break
    case 'mergeCells': chain = chain.mergeCells(); break
    case 'clearRow': chain = chain.deleteRange({ from: target.from, to: target.to }); break
    case 'clearColumn': chain = chain.deleteRange({ from: target.from, to: target.to }); break
    case 'duplicateColumn': chain = chain.addColumnAfter(); break
    default: return
  }

  const ok = chain.run()
  if (!ok) {
    console.warn('[RichTextEditor] tableAction failed:', action)
  }

  if (action === 'deleteTable') {
    showTableControls.value = false
    savedTableSelection.value = null
  }
  // Update controls after action (for delete operations that might remove table)
  nextTick(() => updateTableControls())
}

// Ask for confirmation before destructive table actions, then execute them.
function requestTableAction(action: string) {
  if (action === 'deleteTable') {
    pendingTableAction.value = 'deleteTable'
    tableConfirmTitle.value = '删除表格'
    tableConfirmMessage.value = '确定要删除整个表格吗？此操作不可恢复。'
    tableConfirmVisible.value = true
    return
  }
  tableAction(action)
}

function executePendingTableAction() {
  const action = pendingTableAction.value
  if (!action) return
  pendingTableAction.value = null
  tableConfirmVisible.value = false
  tableAction(action)
}

function cancelPendingTableAction() {
  pendingTableAction.value = null
  tableConfirmVisible.value = false
}

// Return a text selection positioned inside the last cell of the table that
// contains the currently saved table selection. Used after addRowAfter so the
// next row is appended at the bottom instead of inserted before prior ones.
function getLastCellSelection(): { from: number; to: number } | null {
  if (!editor.value || !savedTableSelection.value) return null
  const { state } = editor.value
  const $pos = state.doc.resolve(savedTableSelection.value.from)
  let depth = $pos.depth
  while (depth > 0 && $pos.node(depth).type.name !== 'table') depth--
  if (depth <= 0) return null
  const tableStart = $pos.before(depth)
  const tableNode = $pos.node(depth)
  const map = TableMap.get(tableNode)
  if (!map || map.map.length === 0) return null
  const lastCellPos = map.map[map.map.length - 1]
  const pos = tableStart + lastCellPos + 1
  return { from: pos, to: pos }
}

// Add N rows at the bottom of the current table, moving the selection into the
// newly created last row after each insertion so rows are appended in order.
function batchAddRows(count: number) {
  if (!editor.value || !savedTableSelection.value || count <= 0) return
  for (let i = 0; i < count; i++) {
    const ok = editor.value
      .chain()
      .focus()
      .setTextSelection(savedTableSelection.value)
      .addRowAfter()
      .run()
    if (!ok) break
    const lastSel = getLastCellSelection()
    if (lastSel) savedTableSelection.value = lastSel
  }
  nextTick(() => updateTableControls())
}

// Single click adds one row; holding and dragging down batch-adds rows based on
// the vertical distance traveled.
function onAddRowMouseDown(e: MouseEvent) {
  if (!editor.value || !savedTableSelection.value) return
  e.preventDefault()

  // First row is added immediately on press.
  batchAddRows(1)

  const rowHeight = hoveredRowPos.value?.height || 40
  addRowDrag.value = {
    startY: e.clientY,
    addedCount: 1,
    rowHeight,
  }
  addRowDragCount.value = 1
  addRowDragPos.value = { top: e.clientY + 12, left: e.clientX + 12 }

  document.addEventListener('mousemove', onAddRowDragMove)
  document.addEventListener('mouseup', onAddRowDragUp)
}

function onAddRowDragMove(e: MouseEvent) {
  if (!addRowDrag.value) return
  const deltaY = e.clientY - addRowDrag.value.startY
  const targetCount = Math.max(1, Math.floor(deltaY / addRowDrag.value.rowHeight) + 1)
  if (targetCount > addRowDrag.value.addedCount) {
    batchAddRows(targetCount - addRowDrag.value.addedCount)
    addRowDrag.value.addedCount = targetCount
    addRowDragCount.value = targetCount
  }
  addRowDragPos.value = { top: e.clientY + 12, left: e.clientX + 12 }
}

function onAddRowDragUp() {
  addRowDrag.value = null
  addRowDragCount.value = 0
  document.removeEventListener('mousemove', onAddRowDragMove)
  document.removeEventListener('mouseup', onAddRowDragUp)
}

// ---- Image toolbar ----
function showImageToolbar() {
  if (!editor.value || !editor.value.isActive('image')) {
    hideImageToolbar()
    return
  }
  // Find the selected image in the DOM
  const view = editor.value.view
  const { from } = view.state.selection
  const domAtPos = view.domAtPos(from)
  let node: Node = domAtPos.node
  // Walk up to find the image element
  const img = (node as HTMLElement).closest?.('img') || 
             (node.parentElement?.closest?.('img'))
  if (!img) {
    // Try to find via the selection's direct node
    const selectedNode = view.state.doc.nodeAt(from)
    if (selectedNode?.type.name === 'image') {
      // Use a slight delay to let the DOM render, then find the img
      nextTick(() => {
        const imgs = rteWrapperRef.value?.querySelectorAll('img.ProseMirror-selectednode')
        if (imgs && imgs.length > 0) {
          updateImageToolbarPos(imgs[imgs.length - 1] as HTMLImageElement)
        }
      })
      return
    }
    hideImageToolbar()
    return
  }
  updateImageToolbarPos(img as HTMLImageElement)
}

function updateImageToolbarPos(img: HTMLImageElement) {
  const rect = img.getBoundingClientRect()
  selectedImageRect.value = rect
  // Position toolbar centered below the image
  const toolbarWidth = 320
  let left = rect.left + rect.width / 2 - toolbarWidth / 2
  let top = rect.bottom + 8
  // Clamp to viewport
  if (left < 8) left = 8
  if (left + toolbarWidth > window.innerWidth - 8) left = window.innerWidth - toolbarWidth - 8
  if (top + 48 > window.innerHeight - 8) top = rect.top - 48 - 8
  imageToolbarCoords.value = { top, left }
  imageToolbarVisible.value = true
  hideBubble() // Hide text bubble when image is selected
}

function hideImageToolbar() {
  imageToolbarVisible.value = false
  selectedImageRect.value = null
}

function setImageWidth(width: string) {
  if (!editor.value) return
  const ed = editor.value
  const { state } = ed
  const { from } = state.selection
  const node = state.doc.nodeAt(from)
  if (!node || node.type.name !== 'image') return
  
  const attrs: Record<string, any> = {}
  if (width === 'auto') {
    // Remove width constraint to show original size
    attrs.width = null
    attrs.style = ''
  } else {
    attrs.width = width
    attrs.style = `width: ${width}`
  }
  
  ed.chain().focus().updateAttributes('image', attrs).run()
  // Re-show toolbar after attribute update
  nextTick(() => showImageToolbar())
}

function setImageAlign(align: 'left' | 'center' | 'right') {
  if (!editor.value) return
  const ed = editor.value
  ed.chain().focus().updateAttributes('image', { 
    style: getImageStyleWithAlign(align)
  }).run()
  nextTick(() => showImageToolbar())
}

function getImageStyleWithAlign(align: 'left' | 'center' | 'right'): string {
  const currentWidth = selectedImageRect.value ? `${selectedImageRect.value.width}px` : 'auto'
  const widthStyle = currentWidth !== 'auto' ? `width: ${currentWidth};` : ''
  switch (align) {
    case 'left': return `${widthStyle} display: block; margin-left: 0; margin-right: auto;`
    case 'center': return `${widthStyle} display: block; margin-left: auto; margin-right: auto;`
    case 'right': return `${widthStyle} display: block; margin-left: auto; margin-right: 0;`
  }
}

function openImageLightbox() {
  if (!editor.value) return
  const { state } = editor.value
  const { from } = state.selection
  const node = state.doc.nodeAt(from)
  if (node?.type.name === 'image') {
    emit('image-lightbox', node.attrs.src)
  }
}

function handleImageDblClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const src = (target as HTMLImageElement).src
    if (src) emit('image-lightbox', src)
  }
}
const TURN_INTO_ITEMS = [
  { type: 'paragraph',  label: '正文' },
  { type: 'heading',   label: '标题 1', level: 1 },
  { type: 'heading',   label: '标题 2', level: 2 },
  { type: 'heading',   label: '标题 3', level: 3 },
  { type: 'bulletList', label: '无序列表' },
  { type: 'orderedList', label: '有序列表' },
  { type: 'taskList',   label: '待办清单' },
  { type: 'blockquote', label: '引用块' },
  { type: 'codeBlock',  label: '代码块' },
]

function openTurnInto(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  turnIntoCoords.value = { top: rect.bottom + 6, left: rect.left }
  showTurnInto.value = true
  showColorPicker.value = false
  showAlignPicker.value = false
}

function applyTurnInto(item: { type: string; level?: number }) {
  if (!editor.value) return
  const chain = editor.value.chain().focus()
  // First normalize to paragraph, then apply target type
  chain.setParagraph()
  switch (item.type) {
    case 'paragraph':
      break
    case 'heading':
      chain.toggleHeading({ level: item.level as 1 | 2 | 3 })
      break
    case 'bulletList':
      chain.toggleBulletList()
      break
    case 'orderedList':
      chain.toggleOrderedList()
      break
    case 'taskList':
      chain.toggleTaskList()
      break
    case 'blockquote':
      chain.toggleBlockquote()
      break
    case 'codeBlock':
      chain.toggleCodeBlock()
      break
  }
  chain.run()
  showTurnInto.value = false
  nextTick(() => showBubble(new MouseEvent('mouseup')))
}

// ---- Image drag-drop upload ----
function onEditorDrop(e: DragEvent) {
  if (!editor.value) return
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const imageFiles: File[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    if (f.type.startsWith('image/') && f.size <= MAX_FILE_SIZE) {
      imageFiles.push(f)
    }
  }

  if (imageFiles.length === 0) return

  uploading.value = true
  let loaded = 0
  for (const file of imageFiles) {
    readFileAsDataUrl(file)
      .then(dataUrl => {
        editor.value?.chain().focus().setImage({ src: dataUrl }).run()
        loaded++
        if (loaded >= imageFiles.length) uploading.value = false
      })
      .catch(err => {
        console.error('Image drop failed:', err)
        loaded++
        if (loaded >= imageFiles.length) uploading.value = false
      })
  }
}

// ---- Positioning with flip-up support ----
function onEditorScroll(e?: Event) {
  if (bubbleVisible.value) hideBubble()
  // Don't close the table menu if the user is scrolling the menu itself;
  // otherwise scrolling the page/resizing the window closes it.
  if (e) {
    const target = e.target as HTMLElement
    if (target.closest('.rte-table-controls-wrapper')) return
  }
  showTableMenu.value = false
  showTableColorSubmenu.value = false
}

// ---- Quick Insert (+) button ----
function onQuickInsert() {
  if (!editor.value) return
  const ed = editor.value
  const view = ed.view
  view.focus()
  const endPos = view.state.doc.content.size
  const tr = view.state.tr
  const para = view.state.schema.nodes.paragraph.create()
  tr.insert(endPos, para)
  // Move cursor into the new paragraph
  const newPos = endPos + 1
  const SelCtor = view.state.selection.constructor as any
  tr.setSelection(SelCtor.near(tr.doc.resolve(newPos)))
  view.dispatch(tr)
  // Open slash panel at new paragraph in next tick
  nextTick(() => openSlashPanel(ed))
}

// ---- File attachment click delegation ----
function triggerFileDownload(el: HTMLElement) {
  const dataUrl = el.getAttribute('data-file')
  const filename = el.getAttribute('data-filename') || 'file'
  if (!dataUrl || !dataUrl.startsWith('data:')) return
  try {
    const [header, b64] = dataUrl.split(',')
    if (!b64) return
    const mimeMatch = header.match(/data:([^;]+)/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
    const byteChars = atob(b64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const byteArr = new Uint8Array(byteNums)
    const blob = new Blob([byteArr], { type: mime })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (err) {
    console.error('File download failed:', err)
    alert('文件打开失败')
  }
}

function handleAttachmentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('.rte-file-link') as HTMLElement | null
  if (!link) return
  e.preventDefault()
  e.stopPropagation()
  triggerFileDownload(link)
}

function handleMentionClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const mention = target.closest('[data-type="mention"]') as HTMLElement | null
  if (!mention) return
  const memoId = mention.getAttribute('data-id')
  if (memoId) {
    e.preventDefault()
    e.stopPropagation()
    emit('mention-click', memoId)
  }
}

// ---- Image/File upload ----
function openImagePicker() {
  pendingUploadType.value = 'image'
  imageInputRef.value?.click()
}

function openFilePicker() {
  pendingUploadType.value = 'file'
  fileInputRef.value?.click()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    input.value = ''
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    alert(`图片大小超过限制（最大 ${formatFileSize(MAX_FILE_SIZE)}）`)
    input.value = ''
    return
  }
  uploading.value = true
  try {
    const dataUrl = await readFileAsDataUrl(file)
    editor.value?.chain().focus().setImage({ src: dataUrl }).run()
  } catch (err) {
    console.error('Image embed failed:', err)
    alert('图片处理失败，请重试')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_FILE_SIZE) {
    alert(`文件大小超过限制（最大 ${formatFileSize(MAX_FILE_SIZE)}）`)
    input.value = ''
    return
  }
  uploading.value = true
  try {
    const dataUrl = await readFileAsDataUrl(file)
    editor.value?.chain().focus().insertFileAttachment({
      file: dataUrl,
      filename: file.name,
      displayText: `📎 ${file.name} (${formatFileSize(file.size)})`,
    }).run()
  } catch (err) {
    console.error('File embed failed:', err)
    alert('文件处理失败，请重试')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ---- Editor setup ----
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // We register these extensions separately (with custom options or custom
      // implementations), so disable the StarterKit built-ins to avoid duplicates.
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      trailingNode: false,
      underline: false,
      // dropCursor remains enabled via StarterKit (we don't need a custom config).
    }),
    BulletList,
    OrderedList,
    ListItem,
    Blockquote,
    CodeBlock,
    HorizontalRule,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true, handleWidth: 8, cellMinWidth: 60 }),
    TableRow,
    TableHeader,
    TableCell.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-bg-color') || element.style.backgroundColor || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) return {}
              return {
                'data-bg-color': attributes.backgroundColor,
                style: `background-color: ${attributes.backgroundColor}`,
              }
            },
          },
        }
      },
    }),
    ImageResize.configure({ inline: false, allowBase64: true }),
    LinkExtension.configure({ openOnClick: true, HTMLAttributes: { class: 'rte-link' } }),
    Placeholder.configure({ placeholder: props.placeholder ?? '输入备忘录内容…' }),
    FileAttachment,
    SlashCommand,
    MarkdownInputRules,
    Callout,
    Toggle,
    Mermaid,
    Mindmap,
    // TODO: MemoMention temporarily disabled — @tiptap/extension-mention crashes
    // when char='[' matches all brackets in document content.
    // Replaced by DoubleBracketLinker (InputRule-based, no Suggestion dependency).
    // buildMemoMention(),
    DoubleBracketLinker,
    TrailingNode,
    // EmojiExtension, // TEMP: disabled for freeze diagnosis
    Underline,
    Highlight,
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
    emit('headings-change', extractHeadings(editor.getJSON()))
  },
  onSelectionUpdate: ({ editor }) => {
    updateTableControls()
    // Show/hide image toolbar based on selection
    if (editor.isActive('image')) {
      showImageToolbar()
    } else {
      hideImageToolbar()
    }
  },
  editorProps: {
    attributes: { class: 'rte-editor' },
    handleKeyDown: (view, event) => {
      // Tab indent support
      if (event.key === 'Tab') {
        const { state } = view
        const { selection } = state
        if (selection.empty) {
          const inList =
            editor.value?.isActive('bulletList') ||
            editor.value?.isActive('orderedList') ||
            editor.value?.isActive('taskList')
          if (inList) return false

          if (!event.shiftKey) {
            view.dispatch(state.tr.insertText('\t'))
            return true
          } else {
            const $pos = state.doc.resolve(selection.from)
            const start = $pos.before($pos.depth) + 1
            const textFromStart = state.doc.textBetween(start, selection.from, '', '')
            if (textFromStart.endsWith('\t')) {
              view.dispatch(state.tr.delete(selection.from - 1, selection.from))
              return true
            }
          }
        }
      }
      return false
    },
  },
})

// Sync external modelValue changes
watch(
  () => props.modelValue,
  (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
      editor.value.commands.setContent(val, { emitUpdate: false })
    }
  }
)

// ---- Lifecycle ----
let mousedownCleanup: (() => void) | null = null

onMounted(() => {
  rteWrapperRef.value?.addEventListener('click', handleAttachmentClick)
  rteWrapperRef.value?.addEventListener('click', handleMentionClick)
  rteWrapperRef.value?.addEventListener('drop', onEditorDrop as any)
  rteWrapperRef.value?.addEventListener('dragover', (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
    }
  })
  document.addEventListener('mouseup', showBubble)
  document.addEventListener('mousemove', onDocumentMouseMove)

  // Image double-click for lightbox
  rteWrapperRef.value?.addEventListener('dblclick', handleImageDblClick)

  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const insideBubble = bubbleRef.value?.contains(target)
    const insideTableControls = target.closest('.rte-table-controls-wrapper')
    const insideImageToolbar = target.closest('.rte-image-toolbar')

    // Hide bubble menu when clicking outside of it.
    if (!insideBubble) {
      hideBubble()
    }

    // Hide table menu when clicking outside the table controls (triggers + menu + submenu).
    if (!insideTableControls) {
      showTableMenu.value = false
      showTableColorSubmenu.value = false
    }

    // Hide image toolbar when clicking outside image and toolbar
    if (!insideImageToolbar && target.tagName !== 'IMG') {
      // Delay to let ProseMirror handle selection first
      nextTick(() => {
        if (!editor.value?.isActive('image')) {
          hideImageToolbar()
        }
      })
    }
  }
  document.addEventListener('mousedown', onMouseDown)
  mousedownCleanup = () => document.removeEventListener('mousedown', onMouseDown)

  document.addEventListener('scroll', onEditorScroll, true)
  window.addEventListener('resize', onEditorScroll)
})

onBeforeUnmount(() => {
  rteWrapperRef.value?.removeEventListener('click', handleAttachmentClick)
  rteWrapperRef.value?.removeEventListener('click', handleMentionClick)
  rteWrapperRef.value?.removeEventListener('drop', onEditorDrop as any)
  rteWrapperRef.value?.removeEventListener('dragover', (e: any) => {})
  rteWrapperRef.value?.removeEventListener('dblclick', handleImageDblClick)
  document.removeEventListener('mouseup', showBubble)
  document.removeEventListener('mousemove', onDocumentMouseMove)
  document.removeEventListener('mousemove', onAddRowDragMove)
  document.removeEventListener('mouseup', onAddRowDragUp)
  mousedownCleanup?.()
  document.removeEventListener('scroll', onEditorScroll, true)
  window.removeEventListener('resize', onEditorScroll)
  editor.value?.destroy()
})
</script>

<template>
  <div ref="rteWrapperRef" class="rte-wrapper">
    <!-- Floating Bubble Menu -->
    <Teleport to="body">
      <div
        v-if="bubbleVisible"
        ref="bubbleRef"
        class="rte-bubble-menu"
        :style="{
          position: 'fixed',
          top: `${bubbleCoords.top}px`,
          left: `${bubbleCoords.left}px`,
          transform: 'translateX(-50%)',
        }"
      >
        <button class="rte-bubble-btn" :class="{ active: bubbleIsActive('bold') }" @mousedown.prevent="bubbleToggle('bold')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
          </svg>
        </button>
        <button class="rte-bubble-btn" :class="{ active: bubbleIsActive('italic') }" @mousedown.prevent="bubbleToggle('italic')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="4" x2="10" y2="4"/>
            <line x1="14" y1="20" x2="5" y2="20"/>
            <line x1="15" y1="4" x2="9" y2="20"/>
          </svg>
        </button>
        <button class="rte-bubble-btn" :class="{ active: bubbleIsActive('strike') }" @mousedown.prevent="bubbleToggle('strike')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="12" x2="20" y2="12"/>
            <path d="M6 7h12c.5 0 1 .5 1 1s-.5 1-1 1H6"/>
            <path d="M6 16h8c.5 0 1 .5 1 1s-.5 1-1 1H6"/>
          </svg>
        </button>
        <button class="rte-bubble-btn" :class="{ active: bubbleIsActive('underline') }" @mousedown.prevent="bubbleToggle('underline')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 20h12"/>
            <path d="M8 20v-2c0-4 2-6 4-6s4 2 4 6v2"/>
          </svg>
        </button>
        <div class="rte-bubble-sep"></div>
        <button class="rte-bubble-btn" @mousedown.prevent="openColorPicker">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20"/>
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
          </svg>
        </button>
        <button class="rte-bubble-btn" :class="{ active: bubbleIsActive('highlight') }" @mousedown.prevent="bubbleToggle('highlight')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <line x1="8" y1="12" x2="16" y2="12" stroke-width="2.5"/>
          </svg>
        </button>
        <div class="rte-bubble-sep"></div>
        <button class="rte-bubble-btn" @mousedown.prevent="openAlignPicker">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="15" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class="rte-bubble-sep"></div>
        <button class="rte-bubble-btn" @mousedown.prevent="openTurnInto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>
    </Teleport>

    <!-- Color Picker -->
    <Teleport to="body">
      <div
        v-if="showColorPicker"
        class="rte-color-picker"
        :style="{
          position: 'fixed',
          top: `${colorPickerCoords.top}px`,
          left: `${colorPickerCoords.left}px`,
        }"
      >
        <div class="rte-picker-title">文字颜色</div>
        <div class="rte-picker-grid">
          <button
            v-for="c in TEXT_COLORS"
            :key="c"
            class="rte-color-swatch"
            :style="{ background: c }"
            @mousedown.prevent="applyColor(c)"
          ></button>
        </div>
        <div class="rte-picker-reset" @mousedown.prevent="applyColor(null)">清除颜色</div>
      </div>
    </Teleport>

    <!-- Align Picker -->
    <Teleport to="body">
      <div
        v-if="showAlignPicker"
        class="rte-align-picker"
        :style="{
          position: 'fixed',
          top: `${alignPickerCoords.top}px`,
          left: `${alignPickerCoords.left}px`,
        }"
      >
        <button class="rte-align-option" @mousedown.prevent="applyAlign('left')">左对齐</button>
        <button class="rte-align-option" @mousedown.prevent="applyAlign('center')">居中</button>
        <button class="rte-align-option" @mousedown.prevent="applyAlign('right')">右对齐</button>
        <button class="rte-align-option" @mousedown.prevent="applyAlign('justify')">两端对齐</button>
      </div>
    </Teleport>

    <!-- Turn Into Panel -->
    <Teleport to="body">
      <div
        v-if="showTurnInto"
        class="rte-turn-into-panel"
        :style="{
          position: 'fixed',
          top: `${turnIntoCoords.top}px`,
          left: `${turnIntoCoords.left}px`,
        }"
      >
        <div class="rte-picker-title">转换为</div>
        <button
          v-for="(item, idx) in TURN_INTO_ITEMS"
          :key="idx"
          class="rte-turn-into-option"
          @mousedown.prevent="applyTurnInto(item)"
        >{{ item.label }}</button>
      </div>
    </Teleport>

    <!-- Image Toolbar -->
    <Teleport to="body">
      <div
        v-if="imageToolbarVisible"
        class="rte-image-toolbar"
        :style="{
          position: 'fixed',
          top: `${imageToolbarCoords.top}px`,
          left: `${imageToolbarCoords.left}px`,
        }"
        @mousedown.prevent
      >
        <!-- Width presets -->
        <div class="rte-image-toolbar-group">
          <button
            v-for="preset in IMAGE_WIDTH_PRESETS"
            :key="preset.value"
            type="button"
            class="rte-image-toolbar-btn rte-image-size-btn"
            @mousedown.prevent="setImageWidth(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>
        <div class="rte-bubble-sep"></div>
        <!-- Alignment -->
        <button
          type="button"
          class="rte-image-toolbar-btn"
          title="左对齐"
          @mousedown.prevent="setImageAlign('left')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <button
          type="button"
          class="rte-image-toolbar-btn"
          title="居中"
          @mousedown.prevent="setImageAlign('center')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <button
          type="button"
          class="rte-image-toolbar-btn"
          title="右对齐"
          @mousedown.prevent="setImageAlign('right')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class="rte-bubble-sep"></div>
        <!-- Lightbox -->
        <button
          type="button"
          class="rte-image-toolbar-btn rte-image-lightbox-btn"
          title="查看大图（双击图片也可）"
          @mousedown.prevent="openImageLightbox"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>
    </Teleport>

    <!-- Table Controls: Notion-style row/column triggers + bottom add-row bar -->
    <Teleport to="body">
      <div v-if="showTableControls" class="rte-table-controls-wrapper">
        <!-- Row trigger: on the left edge of the hovered row -->
        <button
          v-if="hoveredRowPos"
          type="button"
          class="rte-table-trigger rte-table-trigger-row"
          :class="{ active: showTableMenu && tableMenuMode === 'row' }"
          :style="{
            position: 'fixed',
            top: `${hoveredRowPos.top + hoveredRowPos.height / 2 - 10}px`,
            left: `${hoveredRowPos.left - 10}px`,
          }"
          tabindex="-1"
          @mousedown.prevent="toggleTableMenu('row')"
          title="行操作"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#6b7280">
            <circle cx="6" cy="9" r="1.8"/>
            <circle cx="12" cy="9" r="1.8"/>
            <circle cx="18" cy="9" r="1.8"/>
            <circle cx="6" cy="15" r="1.8"/>
            <circle cx="12" cy="15" r="1.8"/>
            <circle cx="18" cy="15" r="1.8"/>
          </svg>
        </button>

        <!-- Column trigger: centered on the top border of the hovered column -->
        <button
          v-if="hoveredColPos"
          type="button"
          class="rte-table-trigger rte-table-trigger-col"
          :class="{ active: showTableMenu && tableMenuMode === 'col' }"
          :style="{
            position: 'fixed',
            top: `${hoveredColPos.top - 10}px`,
            left: `${hoveredColPos.left + hoveredColPos.width / 2 - 10}px`,
          }"
          tabindex="-1"
          @mousedown.prevent="toggleTableMenu('col')"
          title="列操作"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#6b7280">
            <circle cx="9" cy="6" r="1.8"/>
            <circle cx="15" cy="6" r="1.8"/>
            <circle cx="9" cy="12" r="1.8"/>
            <circle cx="15" cy="12" r="1.8"/>
            <circle cx="9" cy="18" r="1.8"/>
            <circle cx="15" cy="18" r="1.8"/>
          </svg>
        </button>

        <!-- Bottom add-row bar -->
        <button
          v-if="tableBottomPos"
          type="button"
          class="rte-table-add-row"
          :class="{ dragging: !!addRowDrag }"
          :style="{
            position: 'fixed',
            top: `${tableBottomPos.top}px`,
            left: `${tableBottomPos.left}px`,
            width: `${tableBottomPos.width}px`,
          }"
          tabindex="-1"
          @mousedown.prevent="onAddRowMouseDown"
          title="单击添加一行，按住向下拖动批量添加行"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
        </button>

        <!-- Menu -->
        <div
          v-if="showTableMenu"
          class="rte-table-menu"
          :style="{
            position: 'fixed',
            top: `${tableMenuPos.top}px`,
            left: `${tableMenuPos.left}px`,
          }"
        >
          <div class="rte-picker-title">
            {{ tableMenuMode === 'row' ? '行操作' : tableMenuMode === 'col' ? '列操作' : '表格操作' }}
          </div>

          <!-- Row menu -->
          <template v-if="tableMenuMode === 'row'">
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('addRowBefore')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                在上方插入行
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('addRowAfter')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                在下方插入行
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('clearRow')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                清除内容
              </button>
              <button type="button" class="rte-table-menu-item rte-table-danger" @mousedown.prevent="tableAction('deleteRow')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                删除行
              </button>
            </div>
            <div class="rte-table-menu-group">
              <button
                type="button"
                class="rte-table-menu-item rte-table-submenu-trigger"
                :class="{ active: showTableColorSubmenu }"
                @mouseenter="openTableColorSubmenu"
                @mousedown.prevent="openTableColorSubmenu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                背景颜色
                <span class="rte-submenu-arrow">›</span>
              </button>
            </div>
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item rte-table-danger" @mousedown.prevent="requestTableAction('deleteTable')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                删除表格
              </button>
            </div>
          </template>

          <!-- Column menu -->
          <template v-if="tableMenuMode === 'col'">
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('toggleHeaderColumn')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
                标题列
              </button>
              <button
                type="button"
                class="rte-table-menu-item rte-table-submenu-trigger"
                :class="{ active: showTableColorSubmenu }"
                @mouseenter="openTableColorSubmenu"
                @mousedown.prevent="openTableColorSubmenu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                背景颜色
                <span class="rte-submenu-arrow">›</span>
              </button>
            </div>
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('addColumnBefore')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                在左侧插入
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('addColumnAfter')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                在右侧插入
              </button>
            </div>
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('duplicateColumn')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                创建副本
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('clearColumn')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                清除内容
              </button>
              <button type="button" class="rte-table-menu-item rte-table-danger" @mousedown.prevent="tableAction('deleteColumn')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                删除
              </button>
            </div>
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item rte-table-danger" @mousedown.prevent="requestTableAction('deleteTable')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                删除表格
              </button>
            </div>
          </template>

          <!-- Table menu -->
          <template v-if="tableMenuMode === 'table'">
            <div class="rte-table-menu-group">
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('toggleHeaderRow')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                切换表头行
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('toggleHeaderColumn')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                切换表头列
              </button>
              <button type="button" class="rte-table-menu-item" @mousedown.prevent="tableAction('mergeCells')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6"/><path d="M6 9v6"/><path d="M18 9v6"/><path d="M9 18h6"/></svg>
                合并单元格
              </button>
              <button type="button" class="rte-table-menu-item rte-table-danger" @mousedown.prevent="requestTableAction('deleteTable')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                删除表格
              </button>
            </div>
          </template>
        </div>

        <!-- Table color submenu (secondary panel) -->
        <div
          v-if="showTableColorSubmenu"
          class="rte-table-submenu rte-table-color-submenu"
          :style="{
            position: 'fixed',
            top: `${tableColorSubmenuPos.top}px`,
            left: `${tableColorSubmenuPos.left}px`,
          }"
        >
          <div class="rte-picker-title">背景颜色</div>
          <div class="rte-table-color-scope">
            <button type="button" class="rte-table-color-scope-btn" :class="{ active: tableColorScope === 'cell' }" @mousedown.prevent="tableColorScope = 'cell'">单元格</button>
            <button type="button" class="rte-table-color-scope-btn" :class="{ active: tableColorScope === 'row' }" @mousedown.prevent="tableColorScope = 'row'">整行</button>
            <button type="button" class="rte-table-color-scope-btn" :class="{ active: tableColorScope === 'col' }" @mousedown.prevent="tableColorScope = 'col'">整列</button>
          </div>
          <div class="rte-table-color-grid">
            <button
              v-for="c in TABLE_BG_COLORS"
              :key="c"
              type="button"
              class="rte-table-color-swatch"
              :style="{ background: c }"
              @mousedown.prevent="applyTableColor(c)"
            ></button>
            <button type="button" class="rte-table-color-swatch rte-table-color-swatch-clear" @mousedown.prevent="applyTableColor(null)" title="清除颜色">×</button>
          </div>
        </div>

        <!-- Batch add-row drag count badge -->
        <div
          v-if="addRowDrag && addRowDragCount > 1"
          class="rte-add-row-drag-badge"
          :style="{
            position: 'fixed',
            top: `${addRowDragPos.top}px`,
            left: `${addRowDragPos.left}px`,
          }"
        >
          +{{ addRowDragCount }}
        </div>
      </div>
    </Teleport>

    <!-- Editor -->
    <div class="rte-editor-container">
      <EditorContent :editor="editor" class="rte-editor-content" />
    </div>

    <!-- Table delete confirmation -->
    <ConfirmDialog
      :visible="tableConfirmVisible"
      :title="tableConfirmTitle"
      :message="tableConfirmMessage"
      confirm-text="删除"
      type="danger"
      @confirm="executePendingTableAction"
      @cancel="cancelPendingTableAction"
    />

    <!-- Hidden file inputs -->
    <input ref="imageInputRef" type="file" accept="image/*" class="rte-hidden-input" @change="handleImageUpload" />
    <input ref="fileInputRef" type="file" class="rte-hidden-input" @change="handleFileUpload" />
  </div>
</template>

<style>
/* ---- Tiptap editor content styles ---- */
.rte-editor {
  outline: none;
  min-height: 200px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--color-text-1);
  white-space: pre-wrap;
  tab-size: 2;
}

.rte-editor p {
  margin: 0 0 4px;
  line-height: 1.5;
}

.rte-editor p:last-child {
  margin-bottom: 0;
}

.rte-editor h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 18px 0 10px;
  line-height: 1.3;
  color: var(--color-text-1);
}

.rte-editor h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 14px 0 8px;
  line-height: 1.35;
  color: var(--color-text-1);
}

.rte-editor h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 12px 0 6px;
  line-height: 1.4;
  color: var(--color-text-1);
}

.rte-editor ul,
.rte-editor ol {
  padding-left: 22px;
  margin: 4px 0 8px;
}

.rte-editor li {
  margin-bottom: 2px;
  line-height: 1.5;
}

.rte-editor li p {
  margin: 0;
}

.rte-editor blockquote {
  border-left: 3px solid var(--color-primary);
  padding: 6px 12px;
  margin: 8px 0;
  background: var(--color-bg-3);
  border-radius: 0 6px 6px 0;
  color: var(--color-text-2);
}

.rte-editor blockquote p {
  margin: 0;
}

.rte-editor hr {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: 12px 0;
}

.rte-editor img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: default;
  border: 1px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.rte-editor img:hover {
  border-color: var(--color-border-light, #e5e7eb);
  box-shadow: 0 0 0 1px var(--color-border-light, #e5e7eb);
}

.rte-editor img.ProseMirror-selectednode {
  border-color: var(--color-border-light, #e5e7eb);
  box-shadow: 0 0 0 1px var(--color-border-light, #e5e7eb);
}

.rte-editor a.rte-link {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.rte-editor .rte-file-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  color: var(--color-text-2);
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.rte-editor .rte-file-link:hover {
  background: var(--color-info-light);
  border-color: var(--color-info);
  color: var(--color-info);
}

.rte-editor code {
  background: var(--color-bg-3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.rte-editor pre {
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 8px 0;
  overflow-x: auto;
}

.rte-editor pre code {
  background: none;
  padding: 0;
}

.rte-editor p.is-editor-empty:first-child::before {
  color: var(--color-text-4);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.rte-editor [data-type="mention"] {
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 0 4px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}

.rte-editor .rte-callout {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  margin: 8px 0;
}

.rte-editor .rte-callout-emoji {
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1.5;
}

.rte-editor .rte-callout-content {
  flex: 1;
  min-width: 0;
}

.rte-editor .rte-toggle {
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
}

.rte-editor .rte-toggle-summary {
  padding: 8px 12px;
  background: var(--color-bg-3);
  cursor: pointer;
  font-weight: 500;
  user-select: none;
}

.rte-editor .rte-toggle-content {
  padding: 8px 12px;
}

.rte-editor table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.rte-editor th,
.rte-editor td {
  border: 1px solid var(--color-border-light);
  padding: 6px 10px;
  text-align: left;
}

.rte-editor th {
  background: var(--color-bg-3);
  font-weight: 600;
}

/* Active table cell: colored border around the currently selected cell */
.rte-editor td.rte-active-cell,
.rte-editor th.rte-active-cell {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* Task item layout — Tiptap's addNodeView() renders <li data-checked>
   NOT data-type="taskItem", so we must target data-checked */
.rte-editor li[data-checked],
ul[data-type="taskList"] > li {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  gap: 8px !important;
  list-style: none !important;
}

.rte-editor li[data-checked] > label,
ul[data-type="taskList"] > li > label {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  width: 20px !important;
  min-height: 22px !important;
  margin: 0 !important;
  padding: 0 !important;
}

.rte-editor li[data-checked] > label > input[type="checkbox"],
ul[data-type="taskList"] > li > label > input {
  margin: 0 !important;
  flex-shrink: 0 !important;
}

.rte-editor li[data-checked] > div,
ul[data-type="taskList"] > li > div {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  margin: 0 !important;
}

.rte-editor li[data-checked] > div > p,
ul[data-type="taskList"] > li > div > p {
  margin: 0 !important;
}

/* Bubble menu separator */
.rte-bubble-sep {
  width: 1px;
  background: var(--color-border-light, #e5e7eb);
  margin: 4px 4px;
  align-self: stretch;
}

/* Color picker panel */
.rte-color-picker {
  z-index: 1010;
  position: fixed;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  padding: 8px;
  min-width: 180px;
}

.rte-picker-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3, #6b7280);
  padding: 4px 6px 8px;
}

.rte-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 0 2px 8px;
}

.rte-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--color-border-light, #e5e7eb);
  cursor: pointer;
  transition: transform 0.1s;
  padding: 0;
}

.rte-color-swatch:hover {
  transform: scale(1.15);
}

.rte-picker-reset {
  font-size: 12px;
  color: var(--color-text-3, #6b7280);
  cursor: pointer;
  padding: 6px 8px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  text-align: center;
  border-radius: 0 0 8px 8px;
  transition: background 0.1s;
}

.rte-picker-reset:hover {
  background: var(--color-bg-3, #e5e7eb);
}

/* Align picker panel */
.rte-align-picker {
  z-index: 1010;
  position: fixed;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 120px;
}

.rte-align-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-2, #374151);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: background 0.1s;
}

.rte-align-option:hover {
  background: var(--color-bg-3, #e5e7eb);
}

/* Emoji picker panel (from EmojiExtension) */
.rte-emoji-panel {
  z-index: 9999;
}

/* Turn Into panel */
.rte-turn-into-panel {
  z-index: 1010;
  position: fixed;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 140px;
}

.rte-turn-into-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-2, #374151);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: background 0.1s;
}

.rte-turn-into-option:hover {
  background: var(--color-bg-3, #e5e7eb);
}

/* Table Controls — Notion-style row/column triggers on cell borders + bottom add-row bar */
.rte-table-trigger {
  z-index: 1001;
  position: fixed;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition: background 0.15s, transform 0.15s;
  padding: 0;
}

.rte-table-trigger:hover,
.rte-table-trigger.active {
  background: var(--color-bg-3, rgba(243, 244, 246, 0.9));
  transform: scale(1.05);
}

/* Row trigger centered on the left border of the hovered row */
.rte-table-trigger-row {
  border-radius: 4px;
}
.rte-table-trigger-row svg {
  transform: rotate(90deg);
}

/* Column trigger centered on the top border of the hovered column */
.rte-table-trigger-col {
  border-radius: 4px;
}
.rte-table-trigger-col svg {
  transform: rotate(90deg);
}

/* ProseMirror table column resize handle */
.rte-editor td,
.rte-editor th {
  position: relative;
}

.rte-editor .column-resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 5px;
  background-color: var(--color-primary, #3b82f6);
  opacity: 0.8;
  pointer-events: none;
  z-index: 10;
}

.rte-editor.resize-cursor,
.rte-editor.resize-cursor * {
  cursor: col-resize !important;
}

/* Bottom add-row bar */
.rte-table-add-row {
  z-index: 1001;
  position: fixed;
  height: 22px;
  border: 1px dashed var(--color-border-light, #d1d5db);
  border-top: none;
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-3, #6b7280);
  border-radius: 0 0 6px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}

.rte-table-add-row:hover {
  background: var(--color-primary-light, #e5e7eb);
  color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
}

.rte-table-add-row.dragging {
  cursor: row-resize;
  background: var(--color-primary-light, #dbeafe);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.rte-add-row-drag-badge {
  z-index: 1003;
  position: fixed;
  background: var(--color-primary, #3b82f6);
  color: #fff;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.rte-table-menu {
  z-index: 1002;
  position: fixed;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 180px;
  max-height: min(360px, calc(100vh - 40px));
  overflow-y: auto;
  user-select: none;
}

.rte-table-menu-group {
  padding: 2px 0;
}

.rte-table-menu-group + .rte-table-menu-group {
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  margin-top: 4px;
  padding-top: 6px;
}

.rte-table-menu-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3, #9ca3af);
  padding: 4px 8px 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rte-table-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-2, #374151);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.1s;
  white-space: nowrap;
}

.rte-table-menu-item:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #111827);
}

.rte-table-menu-item svg {
  flex-shrink: 0;
  opacity: 0.65;
}

.rte-table-submenu-trigger {
  justify-content: space-between;
}

.rte-table-submenu-trigger .rte-submenu-arrow {
  margin-left: auto;
  padding-left: 8px;
  font-size: 14px;
  color: var(--color-text-3, #9ca3af);
}

/* Table submenu (e.g. color picker) */
.rte-table-submenu {
  z-index: 1003;
  position: fixed;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 160px;
  max-height: min(360px, calc(100vh - 40px));
  overflow-y: auto;
  user-select: none;
}

/* Table color picker embedded in the row/column menu */
.rte-table-color-scope {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}

.rte-table-color-scope-btn {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface, #fff);
  color: var(--color-text-2, #374151);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
}

.rte-table-color-scope-btn:hover {
  background: var(--color-bg-3, #f3f4f6);
}

.rte-table-color-scope-btn.active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
}

.rte-table-color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 0 8px 8px;
}

.rte-table-color-swatch {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.12s;
}

.rte-table-color-swatch:hover {
  transform: scale(1.1);
  border-color: var(--color-primary, #3b82f6);
}

.rte-table-color-swatch-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-3, #9ca3af);
  font-size: 16px;
  border-style: dashed;
}

.rte-table-color-swatch-clear:hover {
  color: var(--color-text-2, #374151);
  border-style: solid;
}

.rte-table-danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.rte-table-danger:hover svg {
  opacity: 1;
}

/* ===== Image Toolbar ===== */
.rte-image-toolbar {
  z-index: 1003;
  position: fixed;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  padding: 4px 6px;
  user-select: none;
  animation: image-toolbar-fade-in 0.15s ease;
}

@keyframes image-toolbar-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.rte-image-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.rte-image-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--color-text-2, #374151);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
  padding: 0;
}

.rte-image-toolbar-btn:hover {
  background: var(--color-bg-3, #f3f4f6);
  color: var(--color-text-1, #111827);
}

.rte-image-toolbar-btn:active {
  background: var(--color-bg-4, #e5e7eb);
}

.rte-image-size-btn {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  min-width: 36px;
}

.rte-image-size-btn:hover {
  background: var(--color-primary-light, #eff6ff);
  color: var(--color-primary, #3b82f6);
}

.rte-image-lightbox-btn:hover {
  background: var(--color-primary-light, #eff6ff);
  color: var(--color-primary, #3b82f6);
}
</style>

<style scoped>
.rte-wrapper {
  position: relative;
  border: none;
  overflow: hidden;
  background: transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.rte-editor-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
}

.rte-editor-content {
  font-size: 15px;
  color: var(--color-text-1);
  line-height: 1.5;
}

/* Bubble menu */
.rte-bubble-menu {
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.rte-bubble-btn {
  width: 30px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.rte-bubble-btn:hover,
.rte-bubble-btn.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

/* Slash panel */
.rte-slash-panel {
  z-index: 1000;
  width: 260px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.rte-slash-query {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 12px;
  color: var(--color-text-3);
}

.rte-slash-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
}

.rte-slash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.rte-slash-item:hover,
.rte-slash-item.active {
  background: var(--color-bg-3);
}

.rte-slash-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-2);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text-2);
  flex-shrink: 0;
}

.rte-slash-label {
  font-size: 14px;
  color: var(--color-text-1);
  font-weight: 500;
}

.rte-slash-desc {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-3);
}

.rte-slash-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-3);
}

.rte-hidden-input {
  display: none;
}
</style>
