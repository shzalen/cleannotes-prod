/**
 * Mermaid diagram extension for Tiptap.
 *
 * Provides a block-level node that renders Mermaid diagrams as SVG,
 * with inline editing via a modal code editor + live preview.
 */
import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MermaidNodeView from '@/components/MermaidNodeView.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      insertMermaid: (attrs?: { code?: string }) => ReturnType
    }
  }
}

export const Mermaid = Node.create({
  name: 'mermaid',

  group: 'block',

  atom: true,

  isolating: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-code') || '',
        renderHTML: (attributes) => {
          if (!attributes.code) {
            return {}
          }
          return { 'data-code': attributes.code }
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const v = element.getAttribute('data-width')
          return v ? parseInt(v, 10) : null
        },
        renderHTML: (attributes) => {
          if (attributes.width == null) return {}
          return { 'data-width': String(attributes.width) }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const v = element.getAttribute('data-height')
          return v ? parseInt(v, 10) : null
        },
        renderHTML: (attributes) => {
          if (attributes.height == null) return {}
          return { 'data-height': String(attributes.height) }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }]
  },

  renderHTML({ HTMLAttributes }) {
    // data-mermaid must stay first so parseHTML matches consistently
    const { width, height, ...rest } = HTMLAttributes
    const attrs: Record<string, any> = { 'data-mermaid': '', ...rest }
    if (width != null) attrs['data-width'] = String(width)
    if (height != null) attrs['data-height'] = String(height)
    return ['div', attrs]
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return VueNodeViewRenderer(MermaidNodeView as any)
  },

  addCommands() {
    return {
      insertMermaid:
        (attrs?: { code?: string }) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                code:
                  attrs?.code ||
                  'graph TD\n    A[开始] --> B{判断}\n    B -->|是| C[处理]\n    B -->|否| D[结束]\n    C --> D',
              },
            })
            .run()
        },
    }
  },
})
