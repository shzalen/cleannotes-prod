import { Node } from '@tiptap/core'

/**
 * Custom inline node for file attachments.
 * Tiptap by default strips unknown <span> elements and data-* attributes.
 * This extension teaches Tiptap to preserve data-file / data-filename so that
 * click handlers can decode base64 → Blob → download.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attrs: {
        file: string
        filename: string
        displayText: string
      }) => ReturnType
    }
  }
}

export const FileAttachment = Node.create({
  name: 'fileAttachment',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      file: { default: '' },
      filename: { default: '' },
      displayText: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span.rte-file-link',
        getAttrs: (node) => {
          const el = node as HTMLElement
          if (!el) return false
          const file = el.getAttribute('data-file') || ''
          const filename = el.getAttribute('data-filename') || ''
          // For atom nodes, text content must be captured as an attribute
          // because Tiptap discards inline text content of atom nodes
          const displayText = el.textContent || ''
          // Require at least data-file to be present to match
          if (!file) return false
          return { file, filename, displayText }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const { file, filename, displayText } = node.attrs as {
      file: string
      filename: string
      displayText: string
    }
    return [
      'span',
      {
        class: 'rte-file-link',
        'data-file': file,
        'data-filename': filename,
      },
      displayText || `📎 ${filename || 'file'}`,
    ]
  },

  addCommands() {
    return {
      insertFileAttachment:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },
    }
  },
})
