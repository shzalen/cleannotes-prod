/**
 * Cross-tab synchronization via BroadcastChannel.
 *
 * When data changes in one tab, other tabs receive a "refresh" signal
 * and reload the affected store(s) from Supabase.
 */

type SyncMessage =
  | { type: 'tasks-updated'; source: string }
  | { type: 'memos-updated'; source: string }
  | { type: 'todos-updated'; source: string }
  | { type: 'growth-updated'; source: string }
  | { type: 'reports-updated'; source: string }

const CHANNEL_NAME = 'cleannotes-sync'
const SOURCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let channel: BroadcastChannel | null = null
let listeners: Array<(msg: SyncMessage) => void> = []

function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (e: MessageEvent<SyncMessage>) => {
    // Ignore own messages
    if (e.data?.source === SOURCE_ID) return
    listeners.forEach((fn) => fn(e.data))
  }
}

/** Broadcast a change notification to other tabs */
export function broadcastChange(type: SyncMessage['type']) {
  ensureChannel()
  channel?.postMessage({ type, source: SOURCE_ID } satisfies SyncMessage)
}

/** Listen for change notifications from other tabs */
export function onCrossTabSync(fn: (msg: SyncMessage) => void): () => void {
  ensureChannel()
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((f) => f !== fn)
  }
}
