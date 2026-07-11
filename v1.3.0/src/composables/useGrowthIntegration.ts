/**
 * useGrowthIntegration — 将 taskStore 的任务完成事件与 growthStore 的 XP/成就系统连接
 *
 * 在应用初始化时调用一次，设置 onTaskDone 回调：
 * - 任务完成时自动计算 XP
 * - 优先使用服务端 RPC 验证（S6.1），失败时回退到客户端计算
 * - 应用 XP 到 growth state
 * - 显示 XpToast
 * - 检查成就解锁
 * - 检查升级
 */

import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { setOnTaskDone } from '@/stores/task'
import { supabaseVerifyXp } from '@/services/supabase'
import type { XpSource } from '@/types'

export function useGrowthIntegration() {
  const taskStore = useTaskStore()
  const growth = useGrowthStore()

  // 设置回调：当任务状态切换为 done 时触发
  setOnTaskDone(async (task) => {
    // 1. 优先使用服务端 RPC 验证 XP（S6.1）
    const serverResult = await supabaseVerifyXp(task.id)

    // 2. 计算 XP（服务端验证优先，回退到客户端计算）
    const result = serverResult
      ? {
          totalXp: serverResult.totalXp,
          breakdown: serverResult.breakdown.map(b => ({
            source: b.source as XpSource,
            xp: b.xp,
          })),
        }
      : growth.calculateXp(task, growth.streakDays)

    // 3. 记录旧等级（用于判断是否升级）
    const oldLevel = growth.level

    // 4. 应用 XP
    growth.applyXp(result, task.id)

    // 5. 显示 XpToast
    growth.showXpToast(result.totalXp, result.breakdown.map(b => b.source))

    // 6. 检查升级
    if (growth.level > oldLevel) {
      growth.showLevelUpToast(growth.level)
    }

    // 7. 检查成就解锁
    const ctx = growth.buildAchievementContext(taskStore.tasks)
    // 补充 deleteThenCreate flag
    ctx.deleteThenCreate = growth.checkDeleteThenCreateFlag()
    const newAchievements = growth.checkAchievements(ctx)

    // 8. 显示成就 Toast（如果有）
    for (const id of newAchievements) {
      const def = growth.ACHIEVEMENTS.find(a => a.id === id)
      if (def) {
        growth.showAchievementToast(def.name)
      }
    }
  })
}