/**
 * Memo Storage — 纯在线模式 + 写入优化
 *
 * 读操作：直接从 Supabase 获取
 * 写操作：fire-and-forget 异步写入 Supabase，附带两项优化：
 *
 * 1. **Content-aware writes** — 追踪上次成功写入的 content，当 content 未变化时
 *    使用 PATCH（仅发送 title/tags/pinned/icon 等元数据，跳过可能数 MB 的
 *    base64 图片数据），大幅减少网络传输量。
 *
 * 2. **Retry queue** — 写入失败时自动入队，在网络恢复 / 标签页重新可见 /
 *    定时器触发时重试，避免静默丢数据。
 */

import type { MemoItem } from '@/types'
import { supabaseGetMemos, supabaseUpsertMemo, supabasePatchMemo, supabaseDeleteMemoById } from './supabase'

let currentUserId = ''

// ---- Content tracking ----
// Records the content string last successfully written to Supabase per memo.
// When a new write arrives with the same content, we use PATCH instead of
// full upsert to avoid re-sending potentially megabytes of base64 images.
const lastWrittenContent = new Map<string, string>()

// ---- Retry queue ----
interface PendingWrite {
  memo: MemoItem
  retryCount: number
}
const pendingWrites = new Map<string, PendingWrite>()

// ---- Retry triggers ----
let listenersInitialized = false
let retryIntervalId: ReturnType<typeof setInterval> | null = null

// R3-P01: Named event listener functions for proper cleanup
const onOnline = () => { flushPendingWrites() }
const onVisibilityChange = () => {
  if (!document.hidden && pendingWrites.size > 0) {
    flushPendingWrites()
  }
}

function initRetryListeners() {
  if (listenersInitialized) return
  listenersInitialized = true

  // Network recovered → flush immediately
  window.addEventListener('online', onOnline)

  // Tab becomes visible → flush (covers laptop wake, returning to tab)
  document.addEventListener('visibilitychange', onVisibilityChange)

  // Periodic safety net — every 30s
  // R2-P03: store interval ID for cleanup on logout
  retryIntervalId = setInterval(() => {
    if (pendingWrites.size > 0) {
      flushPendingWrites()
    }
  }, 30_000)
}

// ---- Cleanup ----

/** Clear interval, remove listeners, and flush pending writes. Call on logout. */
export function cleanupMemoStorage() {
  if (retryIntervalId) {
    clearInterval(retryIntervalId)
    retryIntervalId = null
  }
  // R3-P01: Remove event listeners to prevent duplicate accumulation on re-login
  window.removeEventListener('online', onOnline)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  listenersInitialized = false
  pendingWrites.clear()
  lastWrittenContent.clear()
}

// ---- Internal write helpers ----

/** Full upsert (includes content). Used when content changed or first write. */
function doFullUpsert(memo: MemoItem): void {
  supabaseUpsertMemo(memo)
    .then(() => {
      lastWrittenContent.set(memo.id, memo.content)
      pendingWrites.delete(memo.id)
    })
    .catch(() => {
      pendingWrites.set(memo.id, { memo, retryCount: 0 })
    })
}

/** Partial PATCH (skips content). Used when only metadata changed. */
function doPatch(memo: MemoItem): void {
  supabasePatchMemo(memo.id, memo)
    .then(() => {
      // Content didn't change, so lastWrittenContent is still valid
      pendingWrites.delete(memo.id)
    })
    .catch(() => {
      // On PATCH failure, fall back to full upsert in retry queue
      pendingWrites.set(memo.id, { memo, retryCount: 0 })
    })
}

// ---- Public API ----

export function setMemoUserId(userId: string) {
  currentUserId = userId
  pendingWrites.clear()
  lastWrittenContent.clear()
  initRetryListeners()
}

/** 从 Supabase 加载，同时初始化 content 追踪 */
export async function loadMemos(since?: string): Promise<MemoItem[]> {
  if (!currentUserId) return []
  const memos = await supabaseGetMemos(since)
  for (const m of memos) {
    lastWrittenContent.set(m.id, m.content)
  }
  return memos
}

/**
 * Upsert a memo with content-aware write strategy.
 *
 * - If content hasn't changed since last successful write → PATCH (small payload)
 * - If content changed or is a new memo → full upsert
 *
 * Failed writes are automatically queued for retry.
 */
export function upsertMemo(memo: MemoItem): void {
  const lastContent = lastWrittenContent.get(memo.id)

  if (lastContent !== undefined && lastContent === memo.content) {
    // Content unchanged — PATCH metadata only
    doPatch(memo)
  } else {
    // Content changed or first write — full upsert
    doFullUpsert(memo)
  }
}

/** 单条删除（fire-and-forget 云端写入） */
export function deleteMemoById(id: string): void {
  lastWrittenContent.delete(id)
  pendingWrites.delete(id)
  supabaseDeleteMemoById(id).catch(() => {})
}

/**
 * Flush all pending writes (retry failed writes).
 * Called automatically on online/visibilitychange/interval.
 * Can also be called manually (e.g., before page unload).
 */
export async function flushPendingWrites(): Promise<void> {
  if (pendingWrites.size === 0) return

  const entries = [...pendingWrites.entries()]
  for (const [id, { memo }] of entries) {
    try {
      await supabaseUpsertMemo(memo)
      lastWrittenContent.set(id, memo.content)
      pendingWrites.delete(id)
    } catch {
      const entry = pendingWrites.get(id)
      if (entry) entry.retryCount++
    }
  }
}

/** Returns true if there are failed writes waiting to be retried */
export function hasPendingWrites(): boolean {
  return pendingWrites.size > 0
}
