import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MemoItem } from '@/types'
import { loadMemos, upsertMemo, deleteMemoById } from '@/services/memoStorage'
import { toUTCISO } from '@/utils/time'
import { broadcastChange } from '@/services/crossTabSync'
import { clearLastSyncAt } from '@/services/syncState'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Strip HTML tags to get plain text for searching */
function stripHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

/** Migrate legacy memos that lack sortOrder */
function migrateSortOrder(memos: MemoItem[]): boolean {
  let changed = false
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

  const searchQuery = ref('')
  const activeTag = ref('')

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

  const pinnedMemos = computed(() =>
    filteredMemos.value
      .filter(m => m.pinned)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt))
  )

  const normalMemos = computed(() =>
    filteredMemos.value
      .filter(m => !m.pinned)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt))
  )

  const allTags = computed(() => {
    const set = new Set<string>()
    for (const m of memos.value) {
      for (const t of m.tags) set.add(t)
    }
    return [...set].sort()
  })

  async function load(force = false) {
    if (loaded.value && !force) return

    if (force) {
      clearLastSyncAt('memos')
    }

    // Full sync — always fetch all data.
    // Incremental sync was removed: pure-online architecture has no
    // client-side data cache to merge into (Pinia state resets on page refresh).
    const data = await loadMemos()
    migrateSortOrder(data)
    memos.value = data

    loaded.value = true
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
    broadcastChange('memos-updated')
    return memo
  }

  function updateMemo(id: string, patch: Partial<Pick<MemoItem, 'title' | 'content' | 'tags' | 'pinned' | 'icon'>>) {
    const idx = memos.value.findIndex(m => m.id === id)
    if (idx === -1) return
    Object.assign(memos.value[idx], patch, { updatedAt: toUTCISO() })
    upsertMemo(memos.value[idx])
    broadcastChange('memos-updated')
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
    broadcastChange('memos-updated')
  }

  function reorderMemo(id: string, targetIndex: number) {
    const target = memos.value.find(m => m.id === id)
    if (!target) return
    const group = target.pinned
      ? pinnedMemos.value.map(m => m.id)
      : normalMemos.value.map(m => m.id)
    const currentIndex = group.indexOf(id)
    if (currentIndex === -1 || currentIndex === targetIndex) return

    const reordered = [...group]
    reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, id)

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
