/**
 * useSync — 增量同步 Composable
 *
 * 每 30 秒从 Supabase 增量拉取远端变更，应用到本地 store。
 * 仅更新 reactive 状态 + local storage，不回写 Supabase（避免循环）。
 *
 * 同时管理 hybrid.ts 的 health check + dirty op replay 生命周期。
 */

import { onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useAiStore } from '@/stores/ai'
import { fetchRemoteChanges, isOnline, syncStatus, lastSyncAt, pushSyncLog, startHealthCheck, stopHealthCheck } from '@/services/hybrid'

const SYNC_INTERVAL = 30_000 // 30 seconds

let syncTimer: ReturnType<typeof setInterval> | null = null

/** 格式化上次同步时间为简短可读格式 */
export function formatLastSync(isoStr: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()

  // 1 分钟内
  if (diffMs < 60_000) return '刚刚'
  // 1 小时内
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`
  // 今天
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  // 其他
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** 执行一次增量同步 */
async function runIncrementalSync() {
  try {
    const changes = await fetchRemoteChanges()
    if (!changes) {
      pushSyncLog('idle', '云端无新变更')
      return
    }

    const taskStore = useTaskStore()
    const aiStore = useAiStore()

    let changeCount = 0

    // 应用任务变更
    for (const task of changes.updatedTasks) {
      taskStore.applyRemoteTask(task)
      changeCount++
    }
    for (const id of changes.deletedTaskIds) {
      taskStore.applyRemoteTaskDelete(id)
      changeCount++
    }

    // 应用回收站变更
    for (const task of changes.updatedDeletedTasks) {
      taskStore.applyRemoteDeletedTask(task)
      changeCount++
    }
    for (const id of changes.deletedDeletedTaskIds) {
      taskStore.applyRemoteDeletedTaskDelete(id)
      changeCount++
    }

    // 应用 AI 消息变更
    for (const msg of changes.updatedAiMessages) {
      aiStore.applyRemoteAiMessage(msg)
      changeCount++
    }
    for (const id of changes.deletedAiMessageIds) {
      aiStore.applyRemoteAiMessageDelete(id)
      changeCount++
    }

    if (changeCount > 0) {
      pushSyncLog('success', `同步 ${changeCount} 项变更`)
    } else {
      pushSyncLog('success', '已是最新')
    }
  } catch {
    pushSyncLog('error', '同步失败，稍后重试')
  }

  const totalChanges = taskCount + deletedCount + changes.updatedDeletedTasks.length + changes.deletedDeletedTaskIds.length + changes.updatedAiMessages.length + changes.deletedAiMessageIds.length
  appendSyncLog({
    type: 'incremental',
    summary: totalChanges > 0
      ? `增量同步: ${taskCount} 任务更新, ${deletedCount} 删除`
      : '增量同步完成，无变更',
    tasksSynced: taskCount,
    deletedSynced: deletedCount,
    memosSynced: 0,
    todosSynced: 0,
    reportsSynced: 0,
    status: 'success',
  })
}

function startSyncLoop() {
  if (syncTimer) return
  // 首次延迟 10 秒执行（避免与登录时的 mergeFromCloud 冲突）
  setTimeout(() => {
    runIncrementalSync()
    syncTimer = setInterval(runIncrementalSync, SYNC_INTERVAL)
  }, 10_000)
}

function stopSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

/**
 * useSync composable
 * 在组件中调用即可自动管理同步生命周期
 */
export function useSync() {
  // 启动 health check（如果尚未启动）
  startHealthCheck()
  // 启动增量同步循环
  startSyncLoop()

  // 组件卸载时停止（仅当所有使用者都卸载后才真正停止）
  onUnmounted(() => {
    // 注意：不在这里停止，因为可能有多个组件使用
    // 同步循环应该在用户退出登录时停止
  })

  return {
    isOnline,
    syncStatus,
    lastSyncAt,
    formatLastSync,
    /** 手动触发一次同步 */
    syncNow: runIncrementalSync,
  }
}

/** 用户退出登录时调用，停止所有同步 */
export function stopAllSync() {
  stopSyncLoop()
  stopHealthCheck()
}
