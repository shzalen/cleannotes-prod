/**
 * Growth Storage — 离线优先（localStorage + Supabase 同步）
 *
 * 写操作：先写 localStorage（同步成功），再异步写 Supabase
 * 读操作：从 localStorage 读取
 * 同步：login 后从 Supabase 拉取云端数据合并到本地
 */

import type { GrowthState, XpEvent, AchievementRecord } from '@/types'
import { supabaseGetGrowth, supabaseUpsertGrowth } from './supabase'
import { toUTCISO } from '@/utils/time'

let currentUserId = ''

function prefix(key: string): string {
  return currentUserId ? `cleannotes_${currentUserId}_growth_${key}` : `cleannotes_growth_${key}`
}

function prefixFlag(key: string): string {
  return currentUserId ? `cleannotes_${currentUserId}_growth_flag_${key}` : `cleannotes_growth_flag_${key}`
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

// ---- User context ----

export function setGrowthUserId(userId: string) {
  currentUserId = userId
}

// ---- GrowthState (single record per user) ----

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

export function getGrowthState(): GrowthState {
  return read<GrowthState>(prefix('state'), DEFAULT_GROWTH_STATE)
}

export function saveGrowthState(state: GrowthState): void {
  write(prefix('state'), state)
  // 后台同步到 Supabase
  void syncGrowthToCloud()
}

// ---- XpEvents (append-only list, capped at 200) ----

const XP_EVENTS_CAP = 200

export function getXpEvents(): XpEvent[] {
  return read<XpEvent[]>(prefix('xp_events'), [])
}

export function appendXpEvent(event: XpEvent): void {
  const events = getXpEvents()
  events.push(event)
  if (events.length > XP_EVENTS_CAP) {
    events.splice(0, events.length - XP_EVENTS_CAP)
  }
  write(prefix('xp_events'), events)
  // 后台同步到 Supabase
  void syncGrowthToCloud()
}

// ---- AchievementRecords (unlocked achievement timestamps) ----

export function getAchievementRecords(): AchievementRecord[] {
  return read<AchievementRecord[]>(prefix('achievements'), [])
}

export function unlockAchievement(record: AchievementRecord): void {
  const records = getAchievementRecords()
  const idx = records.findIndex(r => r.id === record.id)
  if (idx === -1) {
    records.push(record)
  } else {
    records[idx] = record
  }
  write(prefix('achievements'), records)
  // 后台同步到 Supabase
  void syncGrowthToCloud()
}

export function isAchievementUnlocked(id: string): boolean {
  return getAchievementRecords().some(r => r.id === id)
}

// ---- Flag storage (for hidden achievement triggers) ----

export function setFlag(key: string, value: string): void {
  localStorage.setItem(prefixFlag(key), value)
}

export function getAndClearFlag(key: string): string | null {
  const val = localStorage.getItem(prefixFlag(key))
  if (val) localStorage.removeItem(prefixFlag(key))
  return val
}

// ---- Supabase 同步 ----

let syncTimer: ReturnType<typeof setTimeout> | null = null

/** 防抖后台上传：多次调用合并为一次 Supabase 写入（最多延迟 2 秒） */
async function syncGrowthToCloud(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      const state = getGrowthState()
      const xpEvents = getXpEvents()
      const achievements = getAchievementRecords()
      await supabaseUpsertGrowth(state, xpEvents, achievements)
    } catch {
      // 静默失败，下次写入重试
    }
  }, 2000)
}

/** 从 Supabase 拉取并合并到本地（login 时调用） */
export async function syncGrowthFromCloud(): Promise<void> {
  try {
    const cloudData = await supabaseGetGrowth()
    if (!cloudData) return

    const localState = getGrowthState()
    const localXpEvents = getXpEvents()
    const localAchievements = getAchievementRecords()

    // 状态合并：totalXp 高的为权威源（level/xp/totalXp/maxStreakDays 取最大值）
    // 原因：本地可能被重置（如切换域名 localStorage 隔离），云端保留历史进度
    const cloudWins = cloudData.state.totalXp > localState.totalXp
    const mergedState: GrowthState = cloudWins
      ? {
          ...cloudData.state,
          // 累积型字段取双方最大值（云端为基础源，本地可能有更新的计数值）
          streakDays: Math.max(localState.streakDays, cloudData.state.streakDays),
          witheredDays: Math.max(localState.witheredDays, cloudData.state.witheredDays),
          maxStreakDays: Math.max(localState.maxStreakDays, cloudData.state.maxStreakDays),
          // 时间型字段取较新值
          lastActiveDate: [localState.lastActiveDate, cloudData.state.lastActiveDate].sort().pop() || cloudData.state.lastActiveDate,
          lastXpGainAt: [localState.lastXpGainAt, cloudData.state.lastXpGainAt].sort().pop() || cloudData.state.lastXpGainAt,
          // dailyState 以 cloudData 权威值为准（云端 totalXp 更高，状态更可信）
        }
      : {
          ...localState,
          level: Math.max(localState.level, cloudData.state.level),
          xp: Math.max(localState.xp, cloudData.state.xp),
          totalXp: Math.max(localState.totalXp, cloudData.state.totalXp),
          maxStreakDays: Math.max(localState.maxStreakDays, cloudData.state.maxStreakDays),
          streakDays: Math.max(localState.streakDays, cloudData.state.streakDays),
          witheredDays: Math.max(localState.witheredDays, cloudData.state.witheredDays),
          lastActiveDate: [localState.lastActiveDate, cloudData.state.lastActiveDate].sort().pop() || localState.lastActiveDate,
          lastXpGainAt: [localState.lastXpGainAt, cloudData.state.lastXpGainAt].sort().pop() || localState.lastXpGainAt,
          // dailyState：若云端状态更"健康"（vitality > recovery > withered），倾向于使用云端
          // 但本地 totalXp 更高，本地更有发言权；仅在本地非 vitality 且云端为 vitality 时采纳云端
          ...(localState.dailyState !== 'vitality' && cloudData.state.dailyState === 'vitality'
            ? { dailyState: 'vitality' as DailyState }
            : {}),
        }

    // XpEvents：合并去重（按 id），同 ID 冲突时以时间戳较新者为准
    const eventMap = new Map<string, XpEvent>()
    for (const e of localXpEvents) eventMap.set(e.id, e)
    for (const e of cloudData.xpEvents) {
      const existing = eventMap.get(e.id)
      if (!existing || e.createdAt > existing.createdAt) {
        eventMap.set(e.id, e)
      }
    }
    const mergedEvents = Array.from(eventMap.values())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-XP_EVENTS_CAP)

    // Achievements：合并去重（按 id），同 ID 冲突时以 unlockedAt 较新者为准
    const achMap = new Map<string, AchievementRecord>()
    for (const a of localAchievements) achMap.set(a.id, a)
    for (const a of cloudData.achievements) {
      const existing = achMap.get(a.id)
      if (!existing || a.unlockedAt > existing.unlockedAt) {
        achMap.set(a.id, a)
      }
    }
    const mergedAchievements = Array.from(achMap.values())

    // 写回本地
    write(prefix('state'), mergedState)
    write(prefix('xp_events'), mergedEvents)
    write(prefix('achievements'), mergedAchievements)
  } catch {
    // 静默失败
  }
}

/** 立即同步（无防抖），用于 logout 前保存 */
export async function flushGrowthToCloud(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer)
  try {
    const state = getGrowthState()
    const xpEvents = getXpEvents()
    const achievements = getAchievementRecords()
    await supabaseUpsertGrowth(state, xpEvents, achievements)
  } catch {
    // 静默失败
  }
}
