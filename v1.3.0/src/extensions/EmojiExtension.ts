/**
 * Emoji picker triggered by typing `:` (after space or at block start).
 *
 * Pure ProseMirror handleTextInput + native DOM panel.
 * Click an emoji to insert it at cursor position.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

// ---- Emoji data -----------------------------------------------------------

interface EmojiItem {
  emoji: string
  label: string
  keywords: string
}

const EMOJI_LIST: EmojiItem[] = [
  { emoji: '😀', label: 'grinning', keywords: 'smile happy' },
  { emoji: '😃', label: 'smile', keywords: 'happy joy' },
  { emoji: '😄', label: 'laughing', keywords: 'laugh happy' },
  { emoji: '😁', label: 'beaming', keywords: 'smile happy' },
  { emoji: '😆', label: 'laugh', keywords: 'lol rofl' },
  { emoji: '😅', label: 'sweat', keywords: 'nervous' },
  { emoji: '🤣', label: 'rofl', keywords: 'laugh rofl' },
  { emoji: '😂', label: 'joy', keywords: 'laugh happy' },
  { emoji: '🙂', label: 'slightly smile', keywords: 'smile' },
  { emoji: '😉', label: 'wink', keywords: 'flirt' },
  { emoji: '😊', label: 'blush', keywords: 'shy cute' },
  { emoji: '😇', label: 'innocent', keywords: 'angel' },
  { emoji: '🥰', label: 'money', keywords: 'rich cash' },
  { emoji: '🤠', label: 'cowboy', keywords: 'hat' },
  { emoji: '👍', label: 'thumbs up', keywords: 'ok good' },
  { emoji: '👎', label: 'thumbs down', keywords: 'bad' },
  { emoji: '👌', label: 'ok', keywords: 'okay' },
  { emoji: '🤝', label: 'handshake', keywords: 'deal agreement' },
  { emoji: '🙏', label: 'pray', keywords: 'thanks please' },
  { emoji: '👋', label: 'wave', keywords: 'hello hi' },
  { emoji: '🤚', label: 'raised hand', keywords: 'stop' },
  { emoji: '✌', label: 'victory', keywords: 'peace' },
  { emoji: '🤞', label: 'crossed', keywords: 'fingers' },
  { emoji: '😐', label: 'neutral', keywords: 'plain' },
  { emoji: '😑', label: 'expressionless', keywords: 'plain' },
  { emoji: '😶', label: 'no mouth', keywords: '' },
  { emoji: '😏', label: 'smirk', keywords: 'sass' },
  { emoji: '😣', label: 'persevere', keywords: 'sweat' },
  { emoji: '😥', label: 'disappointed', keywords: 'sad' },
  { emoji: '😢', label: 'cry', keywords: 'sad tear' },
  { emoji: '😭', label: 'sob', keywords: 'cry sad' },
  { emoji: '😤', label: 'triumph', keywords: 'angry' },
  { emoji: '😠', label: 'angry', keywords: 'mad' },
  { emoji: '😡', label: 'rage', keywords: 'angry mad' },
  { emoji: '🤬', label: 'swearing', keywords: 'angry' },
  { emoji: '😱', label: 'scream', keywords: 'fear shock' },
  { emoji: '😨', label: 'fearful', keywords: 'scared' },
  { emoji: '😰', label: 'anxious', keywords: 'nervous worried' },
  { emoji: '😥', label: 'sweating', keywords: 'nervous' },
  { emoji: '🥵', label: 'hot', keywords: 'sweat' },
  { emoji: '🥶', label: 'cold', keywords: 'freezing' },
  { emoji: '😓', label: 'sweat smile', keywords: 'hot' },
  { emoji: '❤', label: 'heart', keywords: 'love red' },
  { emoji: '🧡', label: 'orange heart', keywords: 'love' },
  { emoji: '💛', label: 'yellow heart', keywords: 'love' },
  { emoji: '💚', label: 'green heart', keywords: 'love' },
  { emoji: '💙', label: 'blue heart', keywords: 'love' },
  { emoji: '💜', label: 'purple heart', keywords: 'love' },
  { emoji: '🖤', label: 'black heart', keywords: 'love goth' },
  { emoji: '🤍', label: 'white heart', keywords: 'love' },
  { emoji: '💯', label: '100', keywords: 'score perfect' },
  { emoji: '💢', label: 'anger', keywords: 'mad symbol' },
  { emoji: '💨', label: 'dash', keywords: 'wind' },
  { emoji: '💫', label: 'dizzy', keywords: 'stars' },
  { emoji: '💬', label: 'speech', keywords: 'talk chat' },
  { emoji: '💭', label: 'thought', keywords: 'think' },
  { emoji: '♠', label: 'spade', keywords: 'card' },
  { emoji: '♣', label: 'club', keywords: 'card' },
  { emoji: '♥', label: 'heart suit', keywords: 'card love' },
  { emoji: '♦', label: 'diamond', keywords: 'card' },
  { emoji: '🏠', label: 'house', keywords: 'home' },
  { emoji: '🏡', label: 'house garden', keywords: 'home' },
  { emoji: '🏢', label: 'office', keywords: 'building' },
  { emoji: '🏣', label: 'japanese castle', keywords: 'building' },
  { emoji: '🏤', label: 'european castle', keywords: 'building' },
  { emoji: '🏥', label: 'hotel', keywords: 'lodging' },
  { emoji: '🏦', label: 'love hotel', keywords: 'lodging' },
  { emoji: '🏧', label: 'atm', keywords: 'money bank' },
  { emoji: '🚀', label: 'rocket', keywords: 'space launch' },
  { emoji: '✈', label: 'airplane', keywords: 'travel flight' },
  { emoji: '🚂', label: 'locomotive', keywords: 'train' },
  { emoji: '🚃', label: 'railway car', keywords: 'train' },
  { emoji: '🚄', label: 'high speed train', keywords: 'travel' },
  { emoji: '🚅', label: 'bullet train', keywords: 'travel' },
  { emoji: '🚆', label: 'train', keywords: 'travel' },
  { emoji: '🚇', label: 'metro', keywords: 'subway' },
  { emoji: '🚈', label: 'light rail', keywords: 'train' },
  { emoji: '🚉', label: 'station', keywords: 'train' },
  { emoji: '🚌', label: 'bus', keywords: 'travel' },
  { emoji: '🚏', label: 'oncoming bus', keywords: 'travel' },
  { emoji: '🚐', label: 'minibus', keywords: 'travel' },
  { emoji: '🚑', label: 'ambulance', keywords: 'emergency' },
  { emoji: '🚒', label: 'fire engine', keywords: 'emergency' },
  { emoji: '🚓', label: 'police car', keywords: 'emergency' },
  { emoji: '🚔', label: 'oncoming police', keywords: 'emergency' },
  { emoji: '🚕', label: 'taxi', keywords: 'travel' },
  { emoji: '🚖', label: 'rickshaw', keywords: 'travel' },
  { emoji: '🚗', label: 'car', keywords: 'travel' },
  { emoji: '🚘', label: 'oncoming car', keywords: 'travel' },
  { emoji: '🚙', label: 'blue car', keywords: 'travel' },
  { emoji: '🚚', label: 'truck', keywords: 'travel' },
  { emoji: '🚛', label: 'articulated lorry', keywords: 'travel' },
  { emoji: '🚜', label: 'tractor', keywords: 'farm' },
  { emoji: '🏎', label: 'racing car', keywords: 'sport' },
  { emoji: '🏍', label: 'motorcycle', keywords: 'travel' },
  { emoji: '🏎', label: 'auto rickshaw', keywords: 'travel' },
  { emoji: '🚲', label: 'bicycle', keywords: 'travel sport' },
  { emoji: '🛴', label: 'kick scooter', keywords: 'travel' },
  { emoji: '🛵', label: 'motor scooter', keywords: 'travel' },
  { emoji: '🚏', label: 'flag', keywords: 'country' },
  { emoji: '🎉', label: 'party', keywords: 'celebration' },
  { emoji: '🎊', label: 'confetti', keywords: 'celebration party' },
  { emoji: '🎈', label: 'balloon', keywords: 'party celebration' },
  { emoji: '🎁', label: 'gift', keywords: 'present' },
  { emoji: '🎔', label: 'christmas tree', keywords: 'holiday' },
  { emoji: '🎄', label: 'christmas tree', keywords: 'holiday' },
  { emoji: '🎃', label: 'jack-o-lantern', keywords: 'halloween' },
  { emoji: '🎗', label: 'reminder', keywords: 'ribbon' },
  { emoji: '🎟', label: 'ticket', keywords: 'event' },
  { emoji: '🎫', label: 'lottery', keywords: 'gambling' },
  { emoji: '🎖', label: 'medal', keywords: 'award' },
  { emoji: '🏅', label: 'trophy', keywords: 'award winner' },
  { emoji: '⚽', label: 'soccer', keywords: 'sport ball' },
  { emoji: '⚾', label: 'baseball', keywords: 'sport ball' },
  { emoji: '🏀', label: 'basketball', keywords: 'sport ball' },
  { emoji: '🏁', label: 'racing flag', keywords: 'sport' },
  { emoji: '🏂', label: 'ski', keywords: 'sport winter' },
  { emoji: '🏊', label: 'swim', keywords: 'sport' },
  { emoji: '🏋', label: 'weight lift', keywords: 'sport' },
  { emoji: '🏌', label: 'golf', keywords: 'sport' },
  { emoji: '🏍', label: 'motorcycle', keywords: 'sport travel' },
  { emoji: '🏎', label: 'racing', keywords: 'sport' },
  { emoji: '🏏', label: 'table tennis', keywords: 'sport' },
  { emoji: '🏐', label: 'badminton', keywords: 'sport' },
  { emoji: '🏑', label: 'ice hockey', keywords: 'sport' },
  { emoji: '🏒', label: 'hockey', keywords: 'sport' },
  { emoji: '🏓', label: 'ping pong', keywords: 'sport' },
  { emoji: '🏔', label: 'mountain', keywords: 'nature' },
  { emoji: '🌋', label: 'volcano', keywords: 'nature' },
  { emoji: '🗻', label: 'snowy mountain', keywords: 'nature winter' },
  { emoji: '🏕', label: 'camping', keywords: 'outdoors' },
  { emoji: '🏖', label: 'beach', keywords: 'summer vacation' },
  { emoji: '🏗', label: 'building construction', keywords: 'construction' },
  { emoji: '🏘', label: 'house buildings', keywords: 'home' },
  { emoji: '🏙', label: 'cityscape', keywords: 'night' },
  { emoji: '🏚', label: 'derelict house', keywords: 'abandoned' },
  { emoji: '🏛', label: 'classical building', keywords: 'government' },
  { emoji: '🏜', label: 'japanese castle', keywords: 'building' },
  { emoji: '🏝', label: 'desert island', keywords: 'vacation' },
  { emoji: '🏞', label: 'national park', keywords: 'nature' },
  { emoji: '🏟', label: 'stadium', keywords: 'sport' },
  { emoji: '🏠', label: 'house garden', keywords: 'home' },
  { emoji: '🏡', label: 'house', keywords: 'home' },
  { emoji: '☀', label: 'sun', keywords: 'weather hot' },
  { emoji: '🌤', label: 'sun behind cloud', keywords: 'weather' },
  { emoji: '⛅', label: 'sun behind cloud', keywords: 'weather' },
  { emoji: '🌥', label: 'sun behind large cloud', keywords: 'weather' },
  { emoji: '🌦', label: 'sun behind rain cloud', keywords: 'weather' },
  { emoji: '🌧', label: 'rain cloud', keywords: 'weather' },
  { emoji: '⛈', label: 'thunder cloud rain', keywords: 'weather storm' },
  { emoji: '🌩', label: 'cloud with lightning', keywords: 'weather storm' },
  { emoji: '🌨', label: 'cloud with snow', keywords: 'weather winter' },
  { emoji: '❄', label: 'snowflake', keywords: 'winter cold' },
  { emoji: '☃', label: 'snowman', keywords: 'winter' },
  { emoji: '⛄', label: 'snowman without snow', keywords: 'winter' },
  { emoji: '🌬', label: 'wind face', keywords: 'weather' },
  { emoji: '💧', label: 'droplet', keywords: 'water' },
  { emoji: '💨', label: 'dash', keywords: 'wind' },
  { emoji: '☔', label: 'umbrella rain', keywords: 'weather rain' },
  { emoji: '☂', label: 'umbrella', keywords: 'rain weather' },
  { emoji: '🌈', label: 'rainbow', keywords: 'weather beautiful' },
  { emoji: '🌅', label: 'sunrise', keywords: 'morning' },
  { emoji: '🌆', label: 'cityscape sunset', keywords: 'evening' },
  { emoji: '🌇', label: 'sunset', keywords: 'evening' },
  { emoji: '🌉', label: 'fireworks', keywords: 'celebration' },
  { emoji: '🌊', label: 'water wave', keywords: 'ocean sea' },
]

// ---- Plugin state -----------------------------------------------------------

export const emojiPluginKey = new PluginKey('emoji')

let _editor: any = null
let _view: EditorView | null = null
let _range: { from: number; to: number } | null = null
let _keydownHandler: ((e: KeyboardEvent) => void) | null = null
let _docMouseHandler: ((e: MouseEvent) => void) | null = null
let _panel: HTMLElement | null = null
let _query = ''
let _trackRAF: number | null = null

// ---- Helpers ---------------------------------------------------------------

function filterEmojis(query: string): EmojiItem[] {
  if (!query) return EMOJI_LIST.slice(0, 60)
  const q = query.toLowerCase()
  return EMOJI_LIST.filter(e =>
    e.label.toLowerCase().includes(q) ||
    e.keywords.toLowerCase().includes(q)
  )
}

function closePanel() {
  if (_trackRAF) { cancelAnimationFrame(_trackRAF); _trackRAF = null }
  if (_docMouseHandler) { document.removeEventListener('mousedown', _docMouseHandler); _docMouseHandler = null }
  if (_keydownHandler) { document.removeEventListener('keydown', _keydownHandler); _keydownHandler = null }
  if (_panel) { _panel.remove(); _panel = null }
  _view = null
  _editor = null
  _range = null
  _query = ''
}

function renderPanel() {
  if (!_panel || !_view || !_range) return
  _panel.innerHTML = ''

  // Search input
  const searchRow = document.createElement('div')
  searchRow.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--color-border-light,#e5e7eb)'
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = '搜索 emoji…'
  input.value = _query
  input.style.cssText = 'width:100%; border:none; outline:none; background:transparent; font-size:13px; color:var(--color-text-1,#1f2937); padding:4px 6px; border-radius:4px; background:var(--color-bg-2,#f3f4f6)'
  input.addEventListener('input', () => {
    _query = input.value
    renderPanel()
  })
  // Prevent mousedown from closing panel
  input.addEventListener('mousedown', (e) => e.stopPropagation())
  searchRow.appendChild(input)
  _panel.appendChild(searchRow)

  const filtered = filterEmojis(_query)
  if (filtered.length === 0) {
    const empty = document.createElement('div')
    empty.textContent = '没有匹配的 emoji'
    empty.style.cssText = 'padding:16px; text-align:center; font-size:13px; color:var(--color-text-4,#9ca3af)'
    _panel.appendChild(empty)
    return
  }

  // Emoji grid
  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid; grid-template-columns:repeat(8, 1fr); gap:2px; padding:6px; max-height:240px; overflow-y:auto;'

  for (const item of filtered) {
    const btn = document.createElement('button')
    btn.textContent = item.emoji
    btn.title = item.label
    btn.style.cssText = 'width:32px; height:32px; border:none; background:transparent; cursor:pointer; border-radius:6px; font-size:18px; display:flex; align-items:center; justify-content:center; transition:background 0.1s;'
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--color-bg-3,#e5e7eb)' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent' })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(item.emoji)
    })
    grid.appendChild(btn)
  }

  _panel.appendChild(grid)

  // Focus search input
  setTimeout(() => input.focus(), 0)
}

function onSelect(emoji: string) {
  const ed = _editor
  const r = _range
  closePanel()
  if (!ed || !r) { ed?.chain().focus().run(); return }

  // Delete the ':' and any query text, then insert emoji
  ed.chain()
    .focus()
    .deleteRange({ from: r.from, to: ed.state.selection.from })
    .insertContent(emoji)
    .run()
}

function startTracking() {
  if (_trackRAF) cancelAnimationFrame(_trackRAF)
  let lastQuery = _query

  function tick() {
    if (!_view || !_range) return
    const { from } = _view.state.selection
    const queryStart = _range.from + 1
    if (from < queryStart) { closePanel(); return }

    // Read query from document (text between ':' and cursor)
    const newQuery = _view.state.doc.textBetween(queryStart, from, ' ')
    if (newQuery !== lastQuery) {
      lastQuery = newQuery
      _query = newQuery
      renderPanel()
    }

    _trackRAF = requestAnimationFrame(tick)
  }

  _trackRAF = requestAnimationFrame(tick)
}

function showPanel(view: EditorView, editor: any, pos: number) {
  closePanel()
  _editor = editor
  _view = view
  _range = { from: pos - 1, to: pos }
  _query = ''

  const panel = document.createElement('div')
  panel.className = 'rte-emoji-panel'
  panel.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--color-surface,#fff);
    border:1px solid var(--color-border-light,#e5e7eb);
    border-radius:10px;
    box-shadow:0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    width:300px; max-height:360px; overflow:hidden;
    font-family:inherit;
  `

  // Position
  try {
    const safePos = Math.min(pos, Math.max(0, view.state.doc.content.size - 1))
    const coords = view.coordsAtPos(safePos)
    let top = coords.bottom + 6
    let left = coords.left
    if (top + 360 > window.innerHeight - 16) top = coords.top - 360 - 6
    if (left + 300 > window.innerWidth - 16) left = window.innerWidth - 300 - 16
    panel.style.top = `${Math.max(8, top)}px`
    panel.style.left = `${Math.max(8, left)}px`
  } catch {
    panel.style.top = '30%'
    panel.style.left = '30%'
  }

  // Document mousedown listener
  _docMouseHandler = (e: MouseEvent) => {
    if (!_view) return
    if (!(e.target as HTMLElement).closest('.rte-emoji-panel')) {
      closePanel()
    }
  }
  document.addEventListener('mousedown', _docMouseHandler)

  // KeyDown handler
  _keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closePanel(); view.focus(); e.preventDefault(); return }
    if (e.key === 'Enter' && _query) {
      // Insert first filtered emoji
      const filtered = filterEmojis(_query)
      if (filtered.length > 0) { onSelect(filtered[0].emoji); e.preventDefault() }
    }
  }
  document.addEventListener('keydown', _keydownHandler)

  ;(panel as any).__cleanup = () => {
    if (_docMouseHandler) document.removeEventListener('mousedown', _docMouseHandler)
    _docMouseHandler = null
    if (_keydownHandler) document.removeEventListener('keydown', _keydownHandler)
    _keydownHandler = null
    panel.remove()
  }

  _panel = panel
  startTracking()
  renderPanel()
  document.body.appendChild(panel)
}

// ---- Extension ---------------------------------------------------------------

export const EmojiExtension = Extension.create({
  name: 'emojiExtension',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: emojiPluginKey,
        props: {
          handleTextInput(view: EditorView, from: number, _to: number, text: string): boolean {
            if (text !== ':') return false
            // Only trigger at word start (after space, newline, or at block start)
            if (from > 0) {
              const prevChar = view.state.doc.textBetween(from - 1, from, ' ')
              if (prevChar && prevChar !== ' ' && prevChar !== '\n') return false
            }
            showPanel(view, editor, from + 1)
            return false
          },
          handleClick(_view: EditorView, _pos: number, event: MouseEvent) {
            if (!(event.target as HTMLElement).closest('.rte-emoji-panel')) closePanel()
            return false
          },
        },
      }),
    ]
  },
})
