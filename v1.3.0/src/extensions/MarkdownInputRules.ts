import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

/**
 * Extra Markdown-style input rules that StarterKit does not provide.
 * - `- ` or `* ` at block start → bullet list
 * - `1. ` at block start → ordered list
 * - `[ ]` or `[x]` at block start → task list
 * - `::: ` at block start → callout
 * - `>> ` at block start → toggle block
 */
export const MarkdownInputRules = Extension.create({
  name: 'markdownInputRules',

  addInputRules() {
    return [
      // Bullet list: -  or *  at block start
      new InputRule({
        find: /^[-*]\s/,
        handler: ({ state, range, chain }) => {
          const { from, to } = range
          const $from = state.doc.resolve(from)
          if ($from.parentOffset !== 0) return null

          chain()
            .focus()
            .deleteRange({ from, to })
            .toggleBulletList()
            .run()
        },
      }),

      // Ordered list: 1.  at block start
      new InputRule({
        find: /^\d+\.\s/,
        handler: ({ state, range, chain }) => {
          const { from, to } = range
          const $from = state.doc.resolve(from)
          if ($from.parentOffset !== 0) return null

          chain()
            .focus()
            .deleteRange({ from, to })
            .toggleOrderedList()
            .run()
        },
      }),

      // Task list: [ ] or [x] at block start
      new InputRule({
        find: /^\[([ x])\]\s/,
        handler: ({ state, range, match, chain }) => {
          const { from, to } = range
          const $from = state.doc.resolve(from)
          if ($from.parentOffset !== 0) return null

          chain()
            .focus()
            .deleteRange({ from, to })
            .toggleTaskList()
            .command(({ tr }) => {
              const checked = match[1] === 'x'
              if (checked) {
                const pos = tr.selection.from - 1
                const node = tr.doc.nodeAt(pos)
                if (node) tr.setNodeAttribute(pos, 'checked', true)
              }
              return true
            })
            .run()
        },
      }),

      // Callout: ::: at block start
      new InputRule({
        find: /^:::\s/,
        handler: ({ state, range, chain }) => {
          const { from, to } = range
          const $from = state.doc.resolve(from)
          if ($from.parentOffset !== 0) return null

          chain()
            .focus()
            .deleteRange({ from, to })
            .setCallout()
            .run()
        },
      }),

      // Toggle: >> at block start
      new InputRule({
        find: /^>>\s/,
        handler: ({ state, range, chain }) => {
          const { from, to } = range
          const $from = state.doc.resolve(from)
          if ($from.parentOffset !== 0) return null

          chain()
            .focus()
            .deleteRange({ from, to })
            .setToggle()
            .run()
        },
      }),
    ]
  },
})
