/**
 * XMind-style mindmap extension for Tiptap (powered by markmap).
 *
 * Uses markmap-lib to convert Markdown into interactive SVG mindmaps
 * with pan, zoom, and fold/unfold support.
 */
import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MindmapNodeView from '@/components/MindmapNodeView.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mindmap: {
      insertMindmap: (attrs?: { code?: string }) => ReturnType
    }
  }
}

export const Mindmap = Node.create({
  name: 'mindmap',

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
          if (!attributes.code) return {}
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
    return [{ tag: 'div[data-mindmap]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, ...rest } = HTMLAttributes
    const attrs: Record<string, any> = { 'data-mindmap': '', ...rest }
    if (width != null) attrs['data-width'] = String(width)
    if (height != null) attrs['data-height'] = String(height)
    return ['div', attrs]
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return VueNodeViewRenderer(MindmapNodeView as any)
  },

  addCommands() {
    return {
      insertMindmap:
        (attrs?: { code?: string }) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                code:
                  attrs?.code ||
                  '# 核心主题\n' +
                  '## 分支一\n' +
                  '### 子主题 A\n' +
                  '### 子主题 B\n' +
                  '## 分支二\n' +
                  '### 子主题 C\n' +
                  '### 子主题 D\n' +
                  '## 分支三\n' +
                  '### 子主题 E',
              },
            })
            .run()
        },
    }
  },
})
