/**
 * Memo Storage — 离线优先（localStorage + Supabase 同步）
 *
 * 写操作：先写 localStorage（同步成功），再异步写 Supabase
 * 读操作：从 localStorage 读取
 * 同步：login 后从 Supabase 拉取云端数据合并到本地
 */

import type { MemoItem } from '@/types'
import { supabaseGetMemos, supabaseUpsertMemo, supabaseDeleteMemoById } from './supabase'

let currentUserId = ''

function prefix(): string {
  return currentUserId ? `cleannotes_${currentUserId}_memos` : `cleannotes_memos`
}

function readMemos(): MemoItem[] {
  try {
    const raw = localStorage.getItem(prefix())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeMemos(memos: MemoItem[]): void {
  localStorage.setItem(prefix(), JSON.stringify(memos))
}

// ---- Public API ----

export function setMemoUserId(userId: string) {
  currentUserId = userId
}

/** 从 localStorage 加载 */
export function loadMemos(): MemoItem[] {
  return readMemos()
}

/** 全量保存到本地 */
export function saveMemos(memos: MemoItem[]): void {
  writeMemos(memos)
}

/** 单条 upsert（本地 + 后台云端） */
export function upsertMemo(memo: MemoItem): void {
  const memos = readMemos()
  const idx = memos.findIndex(m => m.id === memo.id)
  if (idx === -1) {
    memos.push(memo)
  } else {
    memos[idx] = memo
  }
  writeMemos(memos)

  // 后台异步同步到 Supabase
  supabaseUpsertMemo(memo).catch(() => {})
}

/** 单条删除（本地 + 后台云端） */
export function deleteMemoById(id: string): void {
  const memos = readMemos().filter(m => m.id !== id)
  writeMemos(memos)

  // 后台异步同步到 Supabase
  supabaseDeleteMemoById(id).catch(() => {})
}

/** 从 Supabase 拉取并合并到本地（login 时调用） */
export async function syncMemosFromCloud(): Promise<void> {
  try {
    const cloudData = await supabaseGetMemos()
    if (cloudData.length === 0) return

    const local = readMemos()
    const localMap = new Map(local.map(m => [m.id, m]))

    // 云端数据覆盖本地（updatedAt 更新者胜出）
    for (const cloud of cloudData) {
      const localItem = localMap.get(cloud.id)
      if (!localItem || cloud.updatedAt >= localItem.updatedAt) {
        localMap.set(cloud.id, cloud)
      }
    }

    writeMemos(Array.from(localMap.values()))
  } catch {
    // 静默失败，留待下次同步
  }
}
