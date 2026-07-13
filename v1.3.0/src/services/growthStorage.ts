/**
 * Growth Storage — 纯在线模式
 *
 * 使用内存缓存 + Supabase 持久化：
 * - loadFromCloud(): 从 Supabase 加载到内存缓存
 * - get/save 方法操作内存缓存（同步），写入时 fire-and-forget 到 Supabase
 * - 防抖上传：多次写入合并为一次 Supabase 请求
 */

import type { GrowthState, XpEvent, AchievementRecord } from '@/types'
import { supabaseGetGrowth, supabaseUpsertGrowth } from './supabase'

let currentUserId = ''

// ---- 内存缓存 ----

const DEFAULT_GROWTH_STATE: GrowthState = {
  level: 1,
  xp: 0,
  totalXp: 0,
  streakDays: 0,
  maxStreakDays: 0,
  dailyState: 'vitality',
  witheredDays: 0,
  lastActiveDate: '',
  lastXpGainAt: '',
}

let cachedState: GrowthState = { ...DEFAULT_GROWTH_STATE }
let cachedXpEvents: XpEvent[] = []
let cachedAchievements: AchievementRecord[] = []
let cacheLoaded = false

const XP_EVENTS_CAP = 200

// ---- Flag storage (transient, kept in localStorage) ----

function prefixFlag(key: string): string {
  return currentUserId ? `cleannotes_${currentUserId}_growth_flag_${key}` : `cleannotes_growth_flag_${key}`
}

// ---- User context ----

export function setGrowthUserId(userId: string) {
  currentUserId = userId
  // Reset cache on user switch
  cacheLoaded = false
  cachedState = { ...DEFAULT_GROWTH_STATE }
  cachedXpEvents = []
  cachedAchievements = []
}

// ---- Cloud load ----

/** 从 Supabase 加载数据到内存缓存（登录时调用） */
export async function loadGrowthFromCloud(): Promise<void> {
  if (!currentUserId) return
  try {
    const cloudData = await supabaseGetGrowth()
    if (cloudData) {
      cachedState = cloudData.state
      cachedXpEvents = cloudData.xpEvents ?? []
      cachedAchievements = cloudData.achievements ?? []
    }
    cacheLoaded = true
  } catch {
    // 加载失败也标记为已加载，使用默认值
    cacheLoaded = true
  }
}

// ---- GrowthState ----

export function getGrowthState(): GrowthState {
  return cachedState
}

export function saveGrowthState(state: GrowthState): void {
  cachedState = state
  void syncGrowthToCloud()
}

// ---- XpEvents ----

export function getXpEvents(): XpEvent[] {
  return cachedXpEvents
}

export function appendXpEvent(event: XpEvent): void {
  cachedXpEvents.push(event)
  if (cachedXpEvents.length > XP_EVENTS_CAP) {
    cachedXpEvents.splice(0, cachedXpEvents.length - XP_EVENTS_CAP)
  }
  void syncGrowthToCloud()
}

// ---- AchievementRecords ----

export function getAchievementRecords(): AchievementRecord[] {
  return cachedAchievements
}

export function unlockAchievement(record: AchievementRecord): void {
  const idx = cachedAchievements.findIndex(r => r.id === record.id)
  if (idx === -1) {
    cachedAchievements.push(record)
  } else {
    cachedAchievements[idx] = record
  }
  void syncGrowthToCloud()
}

export function isAchievementUnlocked(id: string): boolean {
  return cachedAchievements.some(r => r.id === id)
}

// ---- Flags ----

export function setFlag(key: string, value: string): void {
  localStorage.setItem(prefixFlag(key), value)
}

export function getAndClearFlag(key: string): string | null {
  const val = localStorage.getItem(prefixFlag(key))
  if (val) localStorage.removeItem(prefixFlag(key))
  return val
}

// ---- Supabase 同步（防抖上传） ----

let syncTimer: ReturnType<typeof setTimeout> | null = null
let visRegistered = false

/** DEF-03 fix: Flush growth data when the tab is hidden/closed */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void flushGrowthToCloud()
  }
}

/** P1-01: Flush on page unload — use sendBeacon fallback for fire-and-forget */
function onBeforeUnload() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  // Best-effort: fire the request without waiting
  // navigator.sendBeacon doesn't support auth headers, so use fetch with keepalive
  try {
    void flushGrowthToCloud()
  } catch {
    // Page is closing, nothing more we can do
  }
}

function ensureVisibilityListener() {
  if (!visRegistered) {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    visRegistered = true
  }
}

/** 防抖后台上传：多次调用合并为一次 Supabase 写入（最多延迟 2 秒） */
async function syncGrowthToCloud(): Promise<void> {
  ensureVisibilityListener()
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      await supabaseUpsertGrowth(cachedState, cachedXpEvents, cachedAchievements)
    } catch {
      // 静默失败
    }
  }, 2000)
}

/** 立即同步（无防抖），用于 logout 前保存 */
export async function flushGrowthToCloud(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer)
  try {
    await supabaseUpsertGrowth(cachedState, cachedXpEvents, cachedAchievements)
  } catch {
    // 静默失败
  }
}

/** 清理 growthStorage 模块级监听器和 timer */
export function cleanupGrowthStorage() {
  if (visRegistered) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('beforeunload', onBeforeUnload)
    visRegistered = false
  }
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
}
