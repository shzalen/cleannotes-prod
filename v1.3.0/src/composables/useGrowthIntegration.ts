/**
 * useGrowthIntegration — 将 taskStore 的任务完成事件与 growthStore 的 XP/成就系统连接
 *
 * 在应用初始化时调用一次，设置 onTaskDone 回调：
 * - 任务完成时自动计算 XP
 * - 应用 XP 到 growth state
 * - 显示 XpToast
 * - 检查成就解锁
 * - 检查升级
 */

import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { setOnTaskDone } from '@/stores/task'

export function useGrowthIntegration() {
  const taskStore = useTaskStore()
  const growth = useGrowthStore()

  // 设置回调：当任务状态切换为 done 时触发
  setOnTaskDone((task) => {
    // 1. 计算 XP
    const result = growth.calculateXp(task, growth.streakDays)

    // 2. 记录旧等级（用于判断是否升级）
    const oldLevel = growth.level

    // 3. 应用 XP
    growth.applyXp(result, task.id)

    // 4. 显示 XpToast
    growth.showXpToast(result.totalXp, result.breakdown.map(b => b.source))

    // 5. 检查升级
    if (growth.level > oldLevel) {
      growth.showLevelUpToast(growth.level)
    }

    // 6. 检查成就解锁
    const ctx = growth.buildAchievementContext(taskStore.tasks)
    // 补充 deleteThenCreate flag
    ctx.deleteThenCreate = growth.checkDeleteThenCreateFlag()
    const newAchievements = growth.checkAchievements(ctx)

    // 7. 显示成就 Toast（如果有）
    for (const id of newAchievements) {
      const def = growth.ACHIEVEMENTS.find(a => a.id === id)
      if (def) {
        growth.showAchievementToast(def.name)
      }
    }
  })
}