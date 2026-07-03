/**
 * Drag Handle extension for block-level drag & drop.
 *
 * Shows a grip icon on the left side when hovering over a block.
 * Pressing and dragging moves the block to a new position.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export const dragHandlePluginKey = new PluginKey('dragHandle')

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: dragHandlePluginKey,

        view(editorView) {
          // ---- Drag handle floating element ----
          const handle = document.createElement('div')
          handle.className = 'rte-drag-handle'
          handle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5"/>
            <circle cx="15" cy="5" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="19" r="1.5"/>
            <circle cx="15" cy="19" r="1.5"/>
          </svg>`
          handle.style.cssText = `
            position:absolute; cursor:grab; display:none; z-index:50;
            color:var(--color-text-4,#9ca3af); padding:2px; border-radius:4px;
          `
          handle.addEventListener('mouseenter', () => {
            handle.style.background = 'var(--color-bg-3,#e5e7eb)'
          })
          handle.addEventListener('mouseleave', () => {
            handle.style.background = 'transparent'
          })
          document.body.appendChild(handle)

          // ---- Insertion indicator ----
          const indicator = document.createElement('div')
          indicator.className = 'rte-drag-indicator'
          indicator.style.cssText = `
            position:absolute; display:none; z-index:49;
            height:2px; background:var(--color-primary,#3b82f6);
            border-radius:1px; pointer-events:none; transition:left 0.05s, width 0.05s;
          `
          document.body.appendChild(indicator)

          let currentBlockPos = -1
          let dragging = false

          // ---- Helpers ----
          function blockPosAtCoords(view: EditorView, coords: { left: number; top: number }): number {
            const pos = view.posAtCoords(coords)
            if (pos === null) return -1
            try {
              const $pos = view.state.doc.resolve(pos.pos)
              const depth = $pos.depth
              if (depth < 1) return -1
              // Node position = position of the opening tag
              return $pos.before(depth) + 1
            } catch {
              return -1
            }
          }

          function showHandle(blockPos: number) {
            try {
              const coords = editorView.coordsAtPos(blockPos)
              handle.style.top = `${coords.top}px`
              handle.style.left = `${Math.max(0, coords.left - 24)}px`
              handle.style.display = 'block'
              currentBlockPos = blockPos
            } catch {
              hideHandle()
            }
          }

          function hideHandle() {
            handle.style.display = 'none'
            currentBlockPos = -1
          }

          // ---- MouseMove: show/hide handle ----
          const onMouseMove = (e: MouseEvent) => {
            if (dragging) return
            const target = e.target as HTMLElement
            if (!editorView.dom.contains(target)) {
              hideHandle()
              return
            }
            const editorRect = editorView.dom.getBoundingClientRect()
            if (e.clientX - editorRect.left > 80) {
              hideHandle()
              return
            }
            const bp = blockPosAtCoords(editorView, { left: e.clientX, top: e.clientY })
            if (bp < 0) {
              hideHandle()
              return
            }
            showHandle(bp)
          }

          // ---- Drag: mousedown on handle ----
          handle.addEventListener('mousedown', (e) => {
            e.preventDefault()
            if (currentBlockPos < 0) return
            dragging = true
            handle.style.cursor = 'grabbing'
            editorView.focus()

            const state = editorView.state
            const $pos = state.doc.resolve(currentBlockPos)
            const depth = $pos.depth
            const node = $pos.node(depth)
            const nodePos = $pos.before(depth) + 1
            const nodeSize = node.nodeSize

            // Ghost preview
            const ghost = document.createElement('div')
            ghost.style.cssText = `
              position:fixed; z-index:9999; pointer-events:none;
              opacity:0.7; background:var(--color-surface,#fff);
              border:1px solid var(--color-primary,#3b82f6);
              border-radius:6px; padding:4px 10px;
              font-size:13px; color:var(--color-text-2,#6b7280);
              box-shadow:0 4px 12px rgba(0,0,0,0.12);
              max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            `
            ghost.textContent = node.textContent.slice(0, 60) || '(空块)'
            document.body.appendChild(ghost)

            const onMove = (e: MouseEvent) => {
              ghost.style.top = `${e.clientY + 14}px`
              ghost.style.left = `${e.clientX + 14}px`

              // Show indicator at insertion point
              const ins = editorView.posAtCoords({ left: e.clientX, top: e.clientY })
              if (ins) {
                try {
                  const ic = editorView.coordsAtPos(ins.pos)
                  indicator.style.top = `${ic.top - 2}px`
                  indicator.style.left = `${ic.left - 20}px`
                  indicator.style.width = `${ic.right - ic.left + 40}px`
                  indicator.style.display = 'block'
                } catch {
                  indicator.style.display = 'none'
                }
              } else {
                indicator.style.display = 'none'
              }
            }

            const onUp = (e: MouseEvent) => {
              dragging = false
              handle.style.cursor = 'grab'
              ghost.remove()
              indicator.style.display = 'none'

              const ins = editorView.posAtCoords({ left: e.clientX, top: e.clientY })
              if (ins && node) {
                // Compute target position with adjustment for deleted range
                let targetPos = ins.pos
                if (targetPos > nodePos) {
                  targetPos = Math.max(nodePos, targetPos - nodeSize)
                }
                // Clamp
                targetPos = Math.max(0, Math.min(targetPos, state.doc.content.size))

                const tr = state.tr.delete(nodePos, nodePos + nodeSize).insert(targetPos, node)
                editorView.dispatch(tr)
              }

              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              hideHandle()
            }

            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          })

          editorView.dom.addEventListener('mousemove', onMouseMove)
          editorView.dom.addEventListener('mouseleave', hideHandle)

          return {
            destroy() {
              handle.remove()
              indicator.remove()
              editorView.dom.removeEventListener('mousemove', onMouseMove)
              editorView.dom.removeEventListener('mouseleave', hideHandle)
            },
          }
        },
      }),
    ]
  },
})
