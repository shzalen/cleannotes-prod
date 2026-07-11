import { Mention } from '@tiptap/extension-mention'
import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionProps } from '@tiptap/suggestion'
import { useMemoStore } from '@/stores/memo'

export const memoMentionPluginKey = new PluginKey('memoMention')

interface MemoSuggestionItem {
  id: string
  label: string
}

/**
 * Module-level state captured at onStart / onUpdate.
 * We keep a snapshot so that mousedown can insert without
 * depending on `savedProps` (which onExit may clear).
 */
let _editor: any = null
let _range: { from: number; to: number } | null = null

/**
 * Find all scrollable parent elements of a given HTMLElement.
 * Returns an array including window, document, and any parent
 * with overflowY === 'auto' | 'scroll'.
 */
function getScrollParents(el: HTMLElement): (HTMLElement | Document | Window)[] {
  const result: (HTMLElement | Document | Window)[] = []
  let parent: HTMLElement | null = el.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      result.push(parent)
    }
    parent = parent.parentElement
  }
  // Always include document-level listeners
  result.push(document, window)
  return result
}

function renderMentionPanel() {
  let component: HTMLElement | null = null
  let selectedIndex = 0
  let currentItems: MemoSuggestionItem[] = []
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null
  let scrollHandler: (() => void) | null = null
  let resizeHandler: (() => void) | null = null
  let scrollTargets: (HTMLElement | Document | Window)[] = []
  let repaintTimer: ReturnType<typeof setInterval> | null = null

  /** Continuously update panel position while open (reliable across all scroll containers) */
  function startRepaintLoop() {
    stopRepaintLoop()
    repaintTimer = setInterval(() => {
      if (!component || !_editor?.view || !_range) return
      const view = _editor.view
      const from = _range.from
      if (from > view.state.doc.content.size) {
        cleanup()
        return
      }
      const coords = view.coordsAtPos(from)

      const EST_HEIGHT = 220
      const gap = 4
      const viewH = window.innerHeight
      const spaceBelow = viewH - coords.bottom
      const spaceAbove = coords.top

      let top: number
      const actualH = component.getBoundingClientRect().height
      const h = actualH > 10 ? actualH : EST_HEIGHT

      if (spaceBelow >= h + gap) {
        top = coords.bottom + gap
      } else if (spaceAbove >= h + gap) {
        top = coords.top - h - gap
      } else {
        // Not enough on either side — pick side with more room
        top = spaceBelow >= spaceAbove ? coords.bottom + gap : coords.top - h - gap
      }

      // Clamp so panel never goes off-screen
      if (top < gap) top = gap
      if (top + h > viewH - gap) top = Math.max(gap, viewH - h - gap)

      const newTop = `${top}px`
      const newLeft = `${coords.left}px`
      if (component.style.top !== newTop || component.style.left !== newLeft) {
        component.style.top = newTop
        component.style.left = newLeft
      }

      // Hide if cursor scrolled far out of viewport
      const vw = coords.top >= -80 && coords.bottom <= viewH + 80
      component.style.display = vw ? '' : 'none'
    }, 120)
  }

  function stopRepaintLoop() {
    if (repaintTimer !== null) {
      clearInterval(repaintTimer)
      repaintTimer = null
    }
  }

  function addScrollListeners(editorDom: HTMLElement) {
    const targets = getScrollParents(editorDom)
    // Also explicitly include .editor-content (the memo editor scroll container)
    // This is the most reliable way to catch scroll events from the memo editor
    const doc = editorDom.ownerDocument || document
    const editorContent = doc.querySelector<HTMLElement>('.editor-content')
    if (editorContent && !targets.includes(editorContent)) {
      targets.push(editorContent)
    }
    // Deduplicate
    const seen = new Set<HTMLElement | Document | Window>()
    const unique: (HTMLElement | Document | Window)[] = []
    for (const t of targets) {
      if (!seen.has(t)) {
        seen.add(t)
        unique.push(t)
      }
    }
    scrollTargets = unique

    scrollHandler = () => {
      if (!component || !_editor?.view || !_range) return
      const view = _editor.view
      const from = _range.from
      if (from > view.state.doc.content.size) {
        cleanup()
        return
      }
      const coords = view.coordsAtPos(from)
      // Check visibility: if cursor is far outside viewport, hide panel
      const inViewport =
        coords.top >= -50 &&
        coords.left >= -50 &&
        coords.top <= window.innerHeight + 100 &&
        coords.left <= window.innerWidth + 100
      if (!inViewport) {
        component.style.display = 'none'
        return
      }
      component.style.display = ''
      component.style.top = `${coords.bottom + 4}px`
      component.style.left = `${coords.left}px`
    }
    resizeHandler = scrollHandler

    for (const t of unique) {
      if (t === window) {
        window.addEventListener('scroll', scrollHandler, true)
        window.addEventListener('resize', resizeHandler)
      } else if (t === document) {
        document.addEventListener('scroll', scrollHandler, true)
      } else {
        t.addEventListener('scroll', scrollHandler, true)
      }
    }
  }

  function removeScrollListeners() {
    for (const t of scrollTargets) {
      if (t === window) {
        window.removeEventListener('scroll', scrollHandler!, true)
        window.removeEventListener('resize', resizeHandler!)
      } else if (t === document) {
        document.removeEventListener('scroll', scrollHandler!, true)
      } else {
        t.removeEventListener('scroll', scrollHandler!, true)
      }
    }
    scrollTargets = []
    scrollHandler = null
    resizeHandler = null
  }

  const renderItems = () => {
    if (!component) return
    component.innerHTML = ''
    if (currentItems.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'rte-mention-empty'
      empty.textContent = '未找到备忘录'
      empty.style.padding = '8px 10px'
      empty.style.fontSize = '12px'
      empty.style.color = 'var(--color-text-4)'
      component.appendChild(empty)
      return
    }
    currentItems.forEach((item, index) => {
      const el = document.createElement('div')
      el.className = 'rte-mention-item'
      el.textContent = `📄 ${item.label}`
      el.style.padding = '7px 10px'
      el.style.borderRadius = '6px'
      el.style.fontSize = '13px'
      el.style.cursor = 'pointer'
      el.style.color = 'var(--color-text-1)'
      el.style.background = index === selectedIndex ? 'var(--color-bg-3)' : 'transparent'
      el.addEventListener('mouseenter', () => {
        selectedIndex = index
        renderItems()
      })
      // mousedown: prevent blur + stop propagation, then insert immediately
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        insertMention(item)
      })
      component!.appendChild(el)
    })
  }

  /**
   * Insert the chosen mention node directly via the Tiptap editor API.
   * Uses the snapshot (_editor / _range) captured at onStart/onUpdate,
   * so it works even if onExit has already run.
   */
  function insertMention(item: MemoSuggestionItem) {
    if (!_editor || !_range) return
    _editor
      .chain()
      .focus()
      .insertContentAt(_range, [
        {
          type: 'mention',
          attrs: {
            id: item.id,
            label: item.label,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run()
    // Clean up panel immediately
    cleanup()
  }

  function cleanup() {
    stopRepaintLoop()
    if (component) {
      component.remove()
      component = null
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
    }
    removeScrollListeners()
    currentItems = []
    selectedIndex = 0
    // Don't clear _editor / _range here; onExit will do it.
  }

  return {
    onStart(props: SuggestionProps<MemoSuggestionItem, MemoSuggestionItem>) {
      // Snapshot editor & range so mousedown can use them later
      _editor = props.editor
      _range = { from: props.range.from, to: props.range.to }
      currentItems = props.items
      selectedIndex = 0

      component = document.createElement('div')
      component.className = 'rte-mention-panel'
      component.style.position = 'fixed'
      component.style.zIndex = '9999'
      component.style.background = 'var(--color-surface)'
      component.style.border = '1px solid var(--color-border-light)'
      component.style.borderRadius = '10px'
      component.style.boxShadow = '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
      component.style.padding = '6px'
      component.style.minWidth = '200px'
      component.style.maxHeight = '260px'
      component.style.overflowY = 'auto'

      const rect = props.clientRect?.()
      if (rect) {
        component.style.top = `${rect.bottom + 4}px`
        component.style.left = `${rect.left}px`
      }

      keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          selectedIndex = (selectedIndex + 1) % Math.max(currentItems.length, 1)
          renderItems()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          selectedIndex = (selectedIndex - 1 + Math.max(currentItems.length, 1)) % Math.max(currentItems.length, 1)
          renderItems()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          if (currentItems[selectedIndex]) {
            insertMention(currentItems[selectedIndex])
          }
        } else if (e.key === 'Escape') {
          props.editor.commands.focus()
          cleanup()
        }
      }
      document.addEventListener('keydown', keydownHandler)

      renderItems()
      document.body.appendChild(component)

      // Attach scroll/resize listeners to all scrollable parents
      if (props.editor?.view?.dom) {
        addScrollListeners(props.editor.view.dom as HTMLElement)
      }
      // Start repaint loop — keeps panel positioned correctly during scroll
      startRepaintLoop()
    },


    onUpdate(props: SuggestionProps<MemoSuggestionItem, MemoSuggestionItem>) {
      // Refresh snapshot on each update (query string may have changed)
      _editor = props.editor
      _range = { from: props.range.from, to: props.range.to }
      currentItems = props.items
      selectedIndex = 0
      if (!component) return
      const rect = props.clientRect?.()
      if (rect) {
        component.style.top = `${rect.bottom + 4}px`
        component.style.left = `${rect.left}px`
      }
      renderItems()
      startRepaintLoop()
    },

    onExit() {
      cleanup()
      _editor = null
      _range = null
    },
  }
}

/**
 * Configure the Mention extension to trigger with `[[` and link to other memos.
 * The rendered node stores the target memo id as data-id; MemoView will
 * handle click to open the linked memo.
 */
export function buildMemoMention(): ReturnType<typeof Mention.configure> {
  return Mention.configure({
    HTMLAttributes: {
      class: 'rte-memo-mention',
    },
    suggestion: {
      char: '[',
      allowSpaces: true,
      startOfLine: false,
      pluginKey: memoMentionPluginKey,
      shouldShow: ({ editor, range }) => {
        // Only show when typing "[[": check char before the trigger
        const view = editor.view
        const from = range.from
        if (from < 2) return false
        const textBefore = view.state.doc.textBetween(from - 2, from, ' ', ' ')
        return textBefore === '[['
      },
      items: ({ query }): MemoSuggestionItem[] => {
        const memos = useMemoStore().memos
        const q = query.toLowerCase().trim()
        return memos
          .filter((m) => !q || m.title.toLowerCase().includes(q))
          .slice(0, 10)
          .map((m) => ({ id: m.id, label: m.title }))
      },
      command: ({ editor, range, props }) => {
        // This is called by keyboard Enter; also used as fallback
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'mention',
              attrs: {
                id: props.id,
                label: props.label,
              },
            },
            {
              type: 'text',
              text: ' ',
            },
          ])
          .run()
      },
      render: renderMentionPanel,
    },
  })
}
