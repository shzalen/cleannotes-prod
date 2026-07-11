/**
 * useSync — 纯在线模式下的同步状态 Composable
 *
 * 不再执行增量同步和健康检查（纯在线模式，数据直接来自 Supabase）。
 * 保留接口兼容性，返回固定的在线状态。
 */

import { ref } from 'vue'
import { isOnline, syncStatus } from '@/services/storage'

const lastSyncAt = ref('')

/** 格式化上次同步时间为简短可读格式 */
export function formatLastSync(_isoStr: string): string {
  return ''
}

/**
 * useSync composable
 * 纯在线模式下仅返回固定状态，不再启动同步循环
 */
export function useSync() {
  return {
    isOnline,
    syncStatus,
    lastSyncAt,
    formatLastSync,
    syncNow: async () => {},
  }
}

/** 用户退出登录时调用（兼容旧代码） */
export function stopAllSync() {}
