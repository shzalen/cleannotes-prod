/**
 * TaskItemStylePlugin — injects inline flex styles into task-item <li> elements.
 *
 * CRITICAL: Tiptap's TaskItem addNodeView() sets data-checked (NOT data-type="taskItem")
 * on the <li>, so we must query by li[data-checked] or ul[data-type="taskList"] > li.
 *
 * Uses ONLY the ProseMirror plugin `update()` hook — NEVER MutationObserver,
 * because observing editor DOM mutations fires on every keystroke/click and breaks ProseMirror.
 */
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

// Track which <li> elements already have the style applied, to skip no-ops
const styledLiSet = new WeakSet<HTMLElement>()

export const TaskItemStylePlugin = new Plugin({
  view(editorView: EditorView) {
    // Apply once on mount (inside requestAnimationFrame so DOM is ready)
    requestAnimationFrame(() => applyStyles(editorView.dom))

    return {
      update(view: EditorView) {
        // This runs after ProseMirror has finished updating the DOM — safe to touch it here
        applyStyles(view.dom)
      },
      destroy() {
        // nothing to clean up
      },
    }
  },
})

function applyStyles(dom: Element) {
  dom.querySelectorAll<HTMLElement>('ul[data-type="taskList"] > li').forEach((li) => {
    // Only apply to <li> elements that belong to a TaskItem (they have data-checked)
    if (li.dataset.checked === undefined) return

    // --- <li> itself ---
    if (!styledLiSet.has(li)) {
      li.style.setProperty('display', 'flex')
      li.style.setProperty('flex-direction', 'row')
      li.style.setProperty('align-items', 'flex-start')
      li.style.setProperty('gap', '8px')
      li.style.setProperty('list-style', 'none')
      styledLiSet.add(li)
    }

    // --- <label> (checkbox wrapper) ---
    const label = li.querySelector<HTMLElement>(':scope > label')
    if (label && !label.dataset.taskStyled) {
      label.style.setProperty('display', 'flex')
      label.style.setProperty('align-items', 'center')
      label.style.setProperty('justify-content', 'center')
      label.style.setProperty('flex-shrink', '0')
      label.style.setProperty('margin', '0')
      label.style.setProperty('padding', '0')
      label.style.setProperty('width', '20px')
      label.style.setProperty('min-height', '22px')
      label.dataset.taskStyled = '1'
    }

    // --- <div> (content wrapper) ---
    const contentDiv = li.querySelector<HTMLElement>(':scope > div')
    if (contentDiv && !contentDiv.dataset.taskStyled) {
      contentDiv.style.setProperty('flex', '1')
      contentDiv.style.setProperty('min-width', '0')
      contentDiv.style.setProperty('margin', '0')
      contentDiv.dataset.taskStyled = '1'
    }
  })
}
