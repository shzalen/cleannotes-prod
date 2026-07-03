import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MemoItem } from '@/types'
import { loadMemos, upsertMemo, deleteMemoById, syncMemosFromCloud, saveMemos } from '@/services/memoStorage'
import { toUTCISO } from '@/utils/time'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Strip HTML tags to get plain text for searching */
function stripHtml(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/** Migrate legacy memos that lack sortOrder */
function migrateSortOrder(memos: MemoItem[]): boolean {
  let changed = false
  // Sort by updatedAt desc then assign descending sortOrder (newest first gets smallest order)
  const sorted = [...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const map = new Map(sorted.map((m, i) => [m.id, i * 1000]))
  for (const m of memos) {
    if (typeof m.sortOrder !== 'number') {
      m.sortOrder = map.get(m.id) ?? 0
      changed = true
    }
  }
  return changed
}

export const useMemoStore = defineStore('memo', () => {
  const memos = ref<MemoItem[]>([])
  const loaded = ref(false)

  /** 搜索关键词 */
  const searchQuery = ref('')
  /** 当前选中的标签筛选（空=全部） */
  const activeTag = ref('')

  /** 先按搜索词过滤，再按标签过滤 */
  const filteredMemos = computed(() => {
    let list = memos.value
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        stripHtml(m.content).toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (activeTag.value) {
      list = list.filter(m => m.tags.includes(activeTag.value))
    }
    return list
  })

  /** 置顶 memo，按 sortOrder 升序 */
  const pinnedMemos = computed(() =>
    filteredMemos.value
      .filter(m => m.pinned)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt))
  )

  /** 普通 memo，按 sortOrder 升序 */
  const normalMemos = computed(() =>
    filteredMemos.value
      .filter(m => !m.pinned)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt))
  )

  /** 所有标签（去重排序） */
  const allTags = computed(() => {
    const set = new Set<string>()
    for (const m of memos.value) {
      for (const t of m.tags) set.add(t)
    }
    return [...set].sort()
  })

  function load() {
    if (loaded.value) return
    const data = loadMemos()
    if (migrateSortOrder(data)) {
      saveMemos(data)
    }
    memos.value = data
    loaded.value = true
    // 后台从云端同步
    syncMemosFromCloud().then(() => {
      const fresh = loadMemos()
      migrateSortOrder(fresh)
      memos.value = fresh
    }).catch(() => {})
  }

  function addMemo(data: {
    title: string
    content?: string
    tags?: string[]
    pinned?: boolean
    icon?: string
  }): MemoItem {
    const now = toUTCISO()
    const pinned = data.pinned || false
    const group = pinned
      ? memos.value.filter(m => m.pinned)
      : memos.value.filter(m => !m.pinned)
    const minOrder = group.length > 0 ? Math.min(...group.map(m => m.sortOrder)) : 0
    const memo: MemoItem = {
      id: genId(),
      title: data.title,
      content: data.content || '',
      tags: data.tags || [],
      pinned,
      icon: data.icon || '',
      sortOrder: minOrder - 1000,
      createdAt: now,
      updatedAt: now,
    }
    memos.value.push(memo)
    upsertMemo(memo)
    return memo
  }

  function updateMemo(id: string, patch: Partial<Pick<MemoItem, 'title' | 'content' | 'tags' | 'pinned' | 'icon'>>) {
    const idx = memos.value.findIndex(m => m.id === id)
    if (idx === -1) return
    Object.assign(memos.value[idx], patch, { updatedAt: toUTCISO() })
    upsertMemo(memos.value[idx])
  }

  function togglePin(id: string) {
    const idx = memos.value.findIndex(m => m.id === id)
    if (idx === -1) return
    const target = memos.value[idx]
    const newPinned = !target.pinned
    const group = memos.value.filter(m => m.pinned === newPinned)
    const minOrder = group.length > 0 ? Math.min(...group.map(m => m.sortOrder)) : 0
    target.pinned = newPinned
    target.sortOrder = minOrder - 1000
    target.updatedAt = toUTCISO()
    upsertMemo(target)
  }

  function removeMemo(id: string) {
    memos.value = memos.value.filter(m => m.id !== id)
    deleteMemoById(id)
  }

  /**
   * Reorder a memo within its pinned/normal group.
   * @param id memo id to move
   * @param targetIndex desired index in the sorted list (0-based)
   */
  function reorderMemo(id: string, targetIndex: number) {
    const target = memos.value.find(m => m.id === id)
    if (!target) return
    const group = target.pinned
      ? pinnedMemos.value.map(m => m.id)
      : normalMemos.value.map(m => m.id)
    const currentIndex = group.indexOf(id)
    if (currentIndex === -1 || currentIndex === targetIndex) return

    // Build new ordered list of ids
    const reordered = [...group]
    reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, id)

    // Reassign sortOrder with stride 1000 to reduce cascading updates
    for (let i = 0; i < reordered.length; i++) {
      const memo = memos.value.find(m => m.id === reordered[i])
      if (memo && memo.sortOrder !== i * 1000) {
        memo.sortOrder = i * 1000
        memo.updatedAt = toUTCISO()
        upsertMemo(memo)
      }
    }
  }

  function getMemoById(id: string): MemoItem | undefined {
    return memos.value.find(m => m.id === id)
  }

  return {
    memos,
    loaded,
    searchQuery,
    activeTag,
    pinnedMemos,
    normalMemos,
    allTags,
    load,
    addMemo,
    updateMemo,
    togglePin,
    removeMemo,
    reorderMemo,
    getMemoById,
  }
})
