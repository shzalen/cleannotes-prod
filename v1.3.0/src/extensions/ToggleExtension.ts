import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      setToggle: (attrs?: { summary?: string }) => ReturnType
      toggleToggle: (attrs?: { summary?: string }) => ReturnType
      unsetToggle: () => ReturnType
    }
  }
}

export interface ToggleOptions {
  HTMLAttributes: Record<string, any>
}

export const Toggle = Node.create<ToggleOptions>({
  name: 'toggleBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'rte-toggle',
      },
    }
  },

  addAttributes() {
    return {
      summary: {
        default: '点击展开',
        parseHTML: (element) => element.querySelector('.rte-toggle-summary')?.textContent || '点击展开',
        renderHTML: (attributes) => ({
          'data-summary': attributes.summary,
        }),
      },
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attributes) => ({
          'data-open': attributes.open,
          open: attributes.open,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'details.rte-toggle',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
    return [
      'details',
      attrs,
      ['summary', { class: 'rte-toggle-summary' }, node.attrs.summary],
      ['div', { class: 'rte-toggle-content' }, 0],
    ]
  },

  addCommands() {
    return {
      setToggle:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
      toggleToggle:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs)
        },
      unsetToggle:
        () =>
        ({ commands }) => {
          return commands.lift(this.name)
        },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos, HTMLAttributes }) => {
      const dom = document.createElement('details')
      dom.className = 'rte-toggle'
      dom.setAttribute('data-summary', node.attrs.summary)
      if (node.attrs.open) dom.setAttribute('open', '')

      const summary = document.createElement('summary')
      summary.className = 'rte-toggle-summary'
      summary.textContent = node.attrs.summary
      summary.contentEditable = 'true'

      // Update summary attribute on blur
      summary.addEventListener('blur', () => {
        const pos = (getPos as () => number)()
        editor.chain().focus().command(({ tr }) => {
          tr.setNodeAttribute(pos, 'summary', summary.textContent || '点击展开')
          return true
        }).run()
      })

      // Enter inside summary should move to content
      summary.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          editor.chain().focus().setTextSelection((getPos as () => number)() + 2).run()
        }
      })

      const content = document.createElement('div')
      content.className = 'rte-toggle-content'

      dom.appendChild(summary)
      dom.appendChild(content)

      return {
        dom,
        contentDOM: content,
      }
    }
  },
})
