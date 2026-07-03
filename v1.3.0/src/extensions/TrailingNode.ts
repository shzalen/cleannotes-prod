/**
 * Trailing Node extension.
 *
 * Ensures there is always an empty paragraph at the end of the document,
 * so the user can always continue typing.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const trailingNodePluginKey = new PluginKey('trailingNode')

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: trailingNodePluginKey,

        appendTransaction(_trs, _oldState, newState) {
          const doc = newState.doc
          if (doc.content.size === 0) return null

          const lastNode = doc.lastChild
          if (!lastNode) return null

          // If the last node is an empty paragraph, nothing to do
          if (lastNode.type.name === 'paragraph' && lastNode.content.size === 0) {
            return null
          }

          // Otherwise, append an empty paragraph
          const { schema } = newState
          const para = schema.nodes.paragraph.create()
          const tr = newState.tr.insert(doc.content.size, para)
          return tr
        },
      }),
    ]
  },
})
