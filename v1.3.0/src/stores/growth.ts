import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GrowthState, DailyState, XpSource, XpEvent, AchievementDef, AchievementRecord } from '@/types'
import {
  getGrowthState, saveGrowthState,
  appendXpEvent, getXpEvents,
  unlockAchievement, getAchievementRecords, isAchievementUnlocked,
  setFlag, getAndClearFlag,
  syncGrowthFromCloud, flushGrowthToCloud,
} from '@/services/growthStorage'
import { toUTCISO, toLocalDate } from '@/utils/time'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 升级所需 XP：Lv.N -> Lv.N+1 需要 N × 20 XP */
function xpToNextLevel(level: number): number {
  return level * 20
}

/** 今天的日期字符串 YYYY-MM-DD */
function todayStr(): string {
  return toLocalDate()
}

/** 当前小时 0-23 */
function currentHour(): number {
  return new Date().getHours()
}

/** 判断日期是否是今天 */
function isToday(dateStr: string): boolean {
  return dateStr.startsWith(todayStr())
}

/** 判断日期是否是昨天 */
function isYesterday(dateStr: string): boolean {
  if (!dateStr) return false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return dateStr.startsWith(toLocalDate(yesterday))
}

// ---- 成就预定义常量 ----

export const ACHIEVEMENTS: AchievementDef[] = [
  // 里程碑
  { id: 'milestone_1', name: '破土', description: '完成 1 个任务', category: 'milestone', condition: 'totalDone >= 1', isHidden: false },
  { id: 'milestone_50', name: '扎根', description: '完成 50 个任务', category: 'milestone', condition: 'totalDone >= 50', isHidden: false },
  { id: 'milestone_200', name: '深根', description: '完成 200 个任务', category: 'milestone', condition: 'totalDone >= 200', isHidden: false },
  { id: 'milestone_500', name: '参天', description: '完成 500 个任务', category: 'milestone', condition: 'totalDone >= 500', isHidden: false },
  { id: 'milestone_1000', name: '林海', description: '完成 1000 个任务', category: 'milestone', condition: 'totalDone >= 1000', isHidden: false },
  // 连续
  { id: 'streak_7', name: '春风', description: '连续 7 天完成任务', category: 'streak', condition: 'maxStreak >= 7', isHidden: false },
  { id: 'streak_30', name: '夏雨', description: '连续 30 天完成任务', category: 'streak', condition: 'maxStreak >= 30', isHidden: false },
  { id: 'streak_100', name: '秋实', description: '连续 100 天完成任务', category: 'streak', condition: 'maxStreak >= 100', isHidden: false },
  { id: 'streak_365', name: '岁寒', description: '连续 365 天完成任务', category: 'streak', condition: 'maxStreak >= 365', isHidden: false },
  // 特殊
  { id: 'special_night_10', name: '星光', description: '凌晨完成 10 个任务', category: 'special', condition: 'nightDone >= 10', isHidden: false },
  { id: 'special_deadline_20', name: '时钟', description: '截止日当天完成 20 个任务', category: 'special', condition: 'deadlineDone >= 20', isHidden: false },
  { id: 'special_daily_10', name: '巧手', description: '单日完成 10 个任务', category: 'special', condition: 'dailyDone >= 10', isHidden: false },
  { id: 'special_full_day', name: '满月', description: '单日完成率 100%', category: 'special', condition: 'dailyRate == 100', isHidden: false },
  // 隐藏
  { id: 'hidden_revive', name: '枯木逢春', description: '倦意态后连续 3 天完成', category: 'hidden', condition: 'witheredThenRevive', isHidden: true },
  { id: 'hidden_restart', name: '从头再来', description: '条件不公开', category: 'hidden', condition: 'deleteThenCreate', isHidden: true },
  { id: 'hidden_night_3', name: '星河入梦', description: '条件不公开', category: 'hidden', condition: 'nightStreak3', isHidden: true },
]

export const useGrowthStore = defineStore('growth', () => {
  const state = ref<GrowthState>(getGrowthState())
  const xpEvents = ref<XpEvent[]>(getXpEvents())
  const unlockedAchievements = ref<AchievementRecord[]>(getAchievementRecords())
  const loaded = ref(false)

  // ---- 烛寄语映射 ----
  const DAILY_MESSAGES: Record<DailyState, string[]> = {
    vitality: ['今天的光亮了一点', '灯亮着就好', '蜡烛又长了一寸'],
    withered: ['灯还亮着，别急', '低光度也是一种状态', '不灭就行'],
    recovery: ['重新点燃了', '回来了就好', '火苗又跳了一下'],
  }

  // ---- 计算属性 ----

  const level = computed(() => state.value.level)
  const xp = computed(() => state.value.xp)
  const totalXp = computed(() => state.value.totalXp)
  const streakDays = computed(() => state.value.streakDays)
  const maxStreakDays = computed(() => state.value.maxStreakDays)
  const dailyState = computed(() => state.value.dailyState)
  const witheredDays = computed(() => state.value.witheredDays)

  const xpToNext = computed(() => xpToNextLevel(state.value.level))
  const xpProgress = computed(() => {
    const needed = xpToNext.value
    return needed > 0 ? Math.min(state.value.xp / needed, 1) : 0
  })

  /** 随机选取当日寄语 */
  const dailyMessage = computed(() => {
    const msgs = DAILY_MESSAGES[state.value.dailyState]
    return msgs[Math.floor(Math.random() * msgs.length)]
  })

  /** 已解锁的成就定义列表 */
  const unlockedDefs = computed(() => {
    const unlockedIds = new Set(unlockedAchievements.value.map(r => r.id))
    return ACHIEVEMENTS.filter(a => unlockedIds.has(a.id))
  })

  /** 未解锁的非隐藏成就列表 */
  const visibleLockedDefs = computed(() => {
    const unlockedIds = new Set(unlockedAchievements.value.map(r => r.id))
    return ACHIEVEMENTS.filter(a => !a.isHidden && !unlockedIds.has(a.id))
  })

  // ---- 持久化 ----

  function persistState() {
    saveGrowthState(state.value)
  }

  // ---- 初始化与日状态更新 ----

  function load() {
    if (loaded.value) return
    state.value = getGrowthState()
    xpEvents.value = getXpEvents()
    unlockedAchievements.value = getAchievementRecords()
    refreshDailyState()
    loaded.value = true
    // 后台从云端同步（不阻塞 UI）
    syncGrowthFromCloud().then(() => {
      // 同步完成后刷新本地数据
      state.value = getGrowthState()
      xpEvents.value = getXpEvents()
      unlockedAchievements.value = getAchievementRecords()
    }).catch(() => {})
  }

  /** 每日首次打开时刷新日状态 */
  function refreshDailyState() {
    const today = todayStr()
    const lastActive = state.value.lastActiveDate

    if (!lastActive || lastActive === today) {
      // 今天已经刷新过，或首次使用
      if (!lastActive) {
        // 首次使用，设为活力态
        state.value.dailyState = 'vitality'
        state.value.witheredDays = 0
      }
      return
    }

    if (isYesterday(lastActive)) {
      // 昨天有活动 → 连续天数 +1
      state.value.streakDays += 1
      if (state.value.streakDays > state.value.maxStreakDays) {
        state.value.maxStreakDays = state.value.streakDays
      }
      // 从倦意态恢复 → 复苏态
      if (state.value.dailyState === 'withered') {
        state.value.dailyState = 'recovery'
        state.value.witheredDays = 0
      } else {
        state.value.dailyState = 'vitality'
      }
    } else {
      // 中断了多天 → 连续天数归零，进入倦意态
      const gapDays = Math.floor(
        (new Date(today).getTime() - new Date(lastActive.slice(0, 10)).getTime()) / 86400000
      )
      state.value.streakDays = 0
      state.value.witheredDays = Math.max(state.value.witheredDays + gapDays - 1, 1)
      state.value.dailyState = 'withered'
    }

    state.value.lastActiveDate = today
    persistState()
  }

  // ---- XP 计算 ----

  interface XpCalcResult {
    totalXp: number
    breakdown: { source: XpSource; xp: number }[]
  }

  /**
   * 计算完成一个任务获得的 XP
   * 在 taskStore.toggleStatus → done 时调用
   */
  function calculateXp(
    task: { priority: string; dueDate: string | null; completedAt: string | null },
    streakDays: number,
  ): XpCalcResult {
    const breakdown: { source: XpSource; xp: number }[] = []

    // 基础完成
    breakdown.push({ source: 'complete', xp: 10 })

    // 高优先加成
    if (task.priority === 'high') {
      breakdown.push({ source: 'priority', xp: 5 })
    }

    // 凌晨加成（0-6点）
    if (task.completedAt && currentHour() < 6) {
      breakdown.push({ source: 'night', xp: 3 })
    }

    // 截止日当天完成加成
    if (task.dueDate && task.completedAt && task.dueDate.startsWith(todayStr())) {
      breakdown.push({ source: 'deadline', xp: 5 })
    }

    // 连续天数加成
    if (streakDays > 0) {
      breakdown.push({ source: 'streak', xp: streakDays * 2 })
    }

    const totalXp = breakdown.reduce((sum, b) => sum + b.xp, 0)
    return { totalXp, breakdown }
  }

  /** 应用 XP 获得结果 */
  function applyXp(result: XpCalcResult, taskId?: string) {
    // 记录每个 XP 来源事件
    for (const b of result.breakdown) {
      const event: XpEvent = {
        id: genId(),
        taskId,
        source: b.source,
        xp: b.xp,
        createdAt: toUTCISO(),
      }
      xpEvents.value.push(event)
      appendXpEvent(event)
    }

    // 更新状态
    state.value.xp += result.totalXp
    state.value.totalXp += result.totalXp
    state.value.lastActiveDate = todayStr()
    state.value.lastXpGainAt = new Date().toISOString()

    // 检查升级
    while (state.value.xp >= xpToNextLevel(state.value.level)) {
      state.value.xp -= xpToNextLevel(state.value.level)
      state.value.level += 1
    }

    // 活力态判定：今日完成 3+ 个任务 → 活力态
    const todayDoneCount = xpEvents.value.filter(
      e => e.source === 'complete' && isToday(e.createdAt)
    ).length
    if (todayDoneCount >= 3) {
      state.value.dailyState = 'vitality'
    } else if (state.value.dailyState === 'withered') {
      // 1 个任务也能从倦意态转复苏态
      state.value.dailyState = 'recovery'
      state.value.witheredDays = 0
    }

    persistState()
  }

  // ---- 成就检查 ----

  /** 统计上下文：用于成就条件判定 */
  interface AchievementContext {
    totalDone: number
    maxStreak: number
    streakDays: number
    nightDone: number
    deadlineDone: number
    dailyDone: number
    dailyRate: number
    witheredThenRevive: boolean
    deleteThenCreate: boolean
    nightStreak3: boolean
  }

  /** 构建成就上下文（需要 taskStore 的任务数据） */
  function buildAchievementContext(
    tasks: { status: string; priority: string; dueDate: string | null; completedAt: string | null; createdAt: string }[],
    _deletedCount?: number,
  ): AchievementContext {
    const doneTasks = tasks.filter(t => t.status === 'done')
    const todayDoneTasks = doneTasks.filter(t => t.completedAt && isToday(t.completedAt))
    const todayAllTasks = tasks.filter(t => {
      const createdOnDay = t.createdAt.startsWith(todayStr())
      const createdBeforeAndUndone = t.createdAt.slice(0, 10) < todayStr() && t.status !== 'done'
      const completedOnDay = t.completedAt != null && isToday(t.completedAt)
      return createdOnDay || createdBeforeAndUndone || completedOnDay
    })

    // 凌晨完成数
    const nightDone = doneTasks.filter(t => {
      if (!t.completedAt) return false
      const hour = new Date(t.completedAt).getHours()
      return hour < 6
    }).length

    // 截止日当天完成数
    const deadlineDone = doneTasks.filter(t => {
      if (!t.dueDate || !t.completedAt) return false
      return t.dueDate.startsWith(t.completedAt.slice(0, 10))
    }).length

    // 单日完成率
    const dailyDone = todayDoneTasks.length
    const dailyRate = todayAllTasks.length > 0
      ? Math.round((dailyDone / todayAllTasks.length) * 100)
      : 0

    // 枯木逢春：倦意态后连续3天完成
    const witheredThenRevive = state.value.dailyState === 'recovery' && state.value.streakDays >= 3

    // 星河入梦：连续3天凌晨完成
    const nightStreak3 = checkNightStreak3()

    return {
      totalDone: doneTasks.length,
      maxStreak: state.value.maxStreakDays,
      streakDays: state.value.streakDays,
      nightDone,
      deadlineDone,
      dailyDone,
      dailyRate,
      witheredThenRevive,
      deleteThenCreate: false,
      nightStreak3,
    }
  }

  /** 检查是否连续3天凌晨完成 */
  function checkNightStreak3(): boolean {
    const events = xpEvents.value
    // 查最近3天是否都有凌晨完成记录
    for (let i = 0; i < 3; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = toLocalDate(d)
      const hasNightEvent = events.some(e => e.source === 'night' && e.createdAt.startsWith(dateStr))
      if (!hasNightEvent) return false
    }
    return true
  }

  /**
   * 检查所有成就条件，自动解锁满足的成就
   * 返回新解锁的成就 ID 列表
   */
  function checkAchievements(ctx: AchievementContext): string[] {
    const newlyUnlocked: string[] = []

    for (const def of ACHIEVEMENTS) {
      if (isAchievementUnlocked(def.id)) continue

      let satisfied = false
      switch (def.condition) {
        case 'totalDone >= 1': satisfied = ctx.totalDone >= 1; break
        case 'totalDone >= 50': satisfied = ctx.totalDone >= 50; break
        case 'totalDone >= 200': satisfied = ctx.totalDone >= 200; break
        case 'totalDone >= 500': satisfied = ctx.totalDone >= 500; break
        case 'totalDone >= 1000': satisfied = ctx.totalDone >= 1000; break
        case 'maxStreak >= 7': satisfied = ctx.maxStreak >= 7; break
        case 'maxStreak >= 30': satisfied = ctx.maxStreak >= 30; break
        case 'maxStreak >= 100': satisfied = ctx.maxStreak >= 100; break
        case 'maxStreak >= 365': satisfied = ctx.maxStreak >= 365; break
        case 'nightDone >= 10': satisfied = ctx.nightDone >= 10; break
        case 'deadlineDone >= 20': satisfied = ctx.deadlineDone >= 20; break
        case 'dailyDone >= 10': satisfied = ctx.dailyDone >= 10; break
        case 'dailyRate == 100': satisfied = ctx.dailyRate === 100; break
        case 'witheredThenRevive': satisfied = ctx.witheredThenRevive; break
        case 'deleteThenCreate': satisfied = ctx.deleteThenCreate; break
        case 'nightStreak3': satisfied = ctx.nightStreak3; break
      }

      if (satisfied) {
        const record: AchievementRecord = {
          id: def.id,
          unlockedAt: new Date().toISOString(),
        }
        unlockAchievement(record)
        unlockedAchievements.value.push(record)
        newlyUnlocked.push(def.id)

        // 成就解锁额外 +20 XP
        const event: XpEvent = {
          id: genId(),
          source: 'achievement',
          xp: 20,
          createdAt: toUTCISO(),
        }
        xpEvents.value.push(event)
        appendXpEvent(event)
        state.value.xp += 20
        state.value.totalXp += 20
        while (state.value.xp >= xpToNextLevel(state.value.level)) {
          state.value.xp -= xpToNextLevel(state.value.level)
          state.value.level += 1
        }
      }
    }

    if (newlyUnlocked.length > 0) {
      persistState()
    }

    return newlyUnlocked
  }

  /** 标记"从头再来"隐藏成就触发条件 */
  function markDeleteThenCreate() {
    setFlag('delete_then_create', '1')
  }

  function checkDeleteThenCreateFlag(): boolean {
    return getAndClearFlag('delete_then_create') === '1'
  }

  // ---- Toast 状态 ----

  const lastXpToast = ref<{ xp: number; sources: XpSource[]; timestamp: number } | null>(null)
  const lastAchievementToast = ref<{ name: string; timestamp: number } | null>(null)
  const lastLevelUpToast = ref<{ level: number; timestamp: number } | null>(null)

  function showXpToast(xp: number, sources: XpSource[]) {
    lastXpToast.value = { xp, sources, timestamp: Date.now() }
  }

  function showAchievementToast(name: string) {
    lastAchievementToast.value = { name, timestamp: Date.now() }
  }

  function showLevelUpToast(level: number) {
    lastLevelUpToast.value = { level, timestamp: Date.now() }
  }

  return {
    state, xpEvents, unlockedAchievements, loaded,
    level, xp, totalXp, streakDays, maxStreakDays, dailyState, witheredDays,
    xpToNext, xpProgress, dailyMessage,
    unlockedDefs, visibleLockedDefs,
    lastXpToast, lastAchievementToast, lastLevelUpToast,
    load, refreshDailyState,
    calculateXp, applyXp,
    buildAchievementContext, checkAchievements,
    markDeleteThenCreate, checkDeleteThenCreateFlag,
    showXpToast, showAchievementToast, showLevelUpToast,
    flushGrowthToCloud,
    ACHIEVEMENTS,
  }
})