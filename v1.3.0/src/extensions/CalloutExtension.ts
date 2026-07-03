import { Node, mergeAttributes, type Command } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { emoji?: string }) => ReturnType
      toggleCallout: (attrs?: { emoji?: string }) => ReturnType
      unsetCallout: () => ReturnType
      setCalloutEmoji: (emoji: string) => ReturnType
    }
  }
}

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'rte-callout',
      },
    }
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.rte-callout',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
    return ['div', attrs, ['div', { class: 'rte-callout-emoji', contenteditable: 'false' }, node.attrs.emoji], ['div', { class: 'rte-callout-content' }, 0]]
  },

  addCommands() {
    return {
      setCallout:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
      toggleCallout:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs)
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name)
        },
      setCalloutEmoji:
        (emoji: string) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { emoji })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => this.editor.commands.command(({ tr, state }) => {
        const { selection, doc } = state
        const { $from, empty } = selection
        if (!empty || $from.parentOffset > 0) return false

        const parentPos = $from.before($from.depth)
        const parent = $from.node($from.depth - 1)
        if (parent?.type.name !== this.name) return false

        // Lift the callout if cursor is at the start of first child block
        const isFirstChild = $from.index($from.depth - 1) === 0
        if (!isFirstChild) return false

        return this.editor.commands.lift(this.name)
      }),
    }
  },
})
