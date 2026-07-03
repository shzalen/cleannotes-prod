/**
 * Double-bracket memo linker: typing `[[` opens a popup to select & insert
 * a cross-reference to another memo.
 *
 * Uses handleTextInput (ProseMirror plugin prop) for reliable detection,
 * avoiding @tiptap/extension-mention's single-char limitation.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { loadMemos } from '@/services/memoStorage'

// ---- Types -------------------------------------------------------------------

interface MemoItem {
  id: string
  title: string
}

export const doubleBracketPluginKey = new PluginKey('doubleBracket')

// ---- Module-level state -----------------------------------------------------

let _editor: any = null
let _view: EditorView | null = null
let _range: { from: number; to: number } | null = null
let _keydownHandler: ((e: KeyboardEvent) => void) | null = null
let _selectedIdx = 0

// ---- Panel helpers ----------------------------------------------------------

function closePanel() {
  const el = document.querySelector('.rte-db-panel') as HTMLElement | null
  if ((el as any)?.__cleanup) (el as any).__cleanup()
  _view = null
  _range = null
  _editor = null
  _selectedIdx = 0
}

function showPanel(view: EditorView, editor: any, pos: number) {
  closePanel()
  _editor = editor
  _view = view

  const memos = loadMemos()
  const items: MemoItem[] = memos.slice(0, 10)

  if (items.length === 0) {
    // No memos — just insert the brackets and return
    _editor = editor
    editor.chain().focus().insertContent('[[').run()
    return
  }

  _range = { from: Math.max(0, pos - 2), to: pos }
  _selectedIdx = 0

  const panel = document.createElement('div')
  panel.className = 'rte-db-panel'
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '9999',
    background: 'var(--color-surface, #fff)',
    border: '1px solid var(--color-border-light, #e5e7eb)',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    padding: '6px 4px',
    minWidth: '220px',
    maxWidth: '320px',
    maxHeight: '280px',
    overflowY: 'auto',
    fontSize: '13px',
  })

  try {
    const safePos = Math.min(pos, Math.max(0, view.state.doc.content.size - 1))
    const coords = view.coordsAtPos(safePos)
    let top = coords.bottom + 6
    let left = coords.left
    if (top + 280 > window.innerHeight - 16) top = coords.top - 280 - 6
    panel.style.top = `${Math.max(8, top)}px`
    panel.style.left = `${Math.max(8, left)}px`
  } catch {
    panel.style.top = '30%'
    panel.style.left = '30%'
  }

  function render() {
    panel.innerHTML = ''
    items.forEach((item, idx) => {
      const el = document.createElement('div')
      const active = idx === _selectedIdx
      el.innerHTML =
        `<span style="margin-right:8px;font-size:14px">📄</span>` +
        `<span style="font-size:13px;color:var(--color-text-1,#1f2937);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.title || '无标题'}</span>`
      Object.assign(el.style, {
        display: 'flex',
        alignItems: 'center',
        padding: '7px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        margin: '1px 2px',
        background: active ? 'var(--color-bg-3, #e5e7eb)' : 'transparent',
        transition: 'background 0.1s',
      })
      el.addEventListener('mouseenter', () => { _selectedIdx = idx; render() })
      el.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect(item)
      })
      panel.appendChild(el)
    })
  }

  function onSelect(item: MemoItem) {
    const ed = _editor
    const r = _range
    closePanel()
    if (!ed || !r) { ed?.chain().focus().run(); return }

    // Delete the [[ text (might have extra typed chars after it)
    const doc = ed.state.doc
    const $start = doc.resolve(r.from)
    const blockEnd = $start.end($start.depth)
    const textAfter = doc.textBetween(r.to, blockEnd, '', '')
    const closeIdx = textAfter.indexOf(']]')
    const deleteEnd = closeIdx >= 0 ? r.to + closeIdx + 2 : r.to

    ed.chain()
      .focus()
      .deleteRange({ from: r.from, to: deleteEnd })
      .insertContent(`[@${item.title || '备忘'}](memo:${item.id}) `)
      .run()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      _selectedIdx = (_selectedIdx + 1) % items.length
      render()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      _selectedIdx = (_selectedIdx - 1 + items.length) % items.length
      render()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[_selectedIdx]) onSelect(items[_selectedIdx])
    } else if (e.key === 'Escape') {
      closePanel()
      view.focus()
    }
  }

  _keydownHandler = onKeyDown
  document.addEventListener('keydown', _keydownHandler)
  ;(panel as any).__cleanup = () => {
    if (_keydownHandler) document.removeEventListener('keydown', _keydownHandler)
    _keydownHandler = null
    panel.remove()
  }

  render()
  document.body.appendChild(panel)
}

// ---- Extension --------------------------------------------------------------

export const DoubleBracketLinker = Extension.create({
  name: 'doubleBracket',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: doubleBracketPluginKey,
        props: {
          handleTextInput(view: EditorView, from: number, to: number, text: string): boolean {
            if (text !== '[') return false
            const doc = view.state.doc
            if (from < 1) return false
            const charBefore = doc.textBetween(from - 1, from, '', '')
            if (charBefore !== '[') return false
            showPanel(view, editor, to)
            return false
          },
          handleClick(_view: EditorView, _pos: number, event: MouseEvent) {
            if (!(event.target as HTMLElement).closest('.rte-db-panel')) closePanel()
            return false
          },
        },
      }),
    ]
  },
})
