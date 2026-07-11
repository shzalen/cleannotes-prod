/**
 * Weekly Report Storage — 纯在线模式
 *
 * 读操作：直接从 Supabase 获取
 * 写操作：fire-and-forget 异步写入 Supabase
 */

import type { WeeklyReport } from '@/types'
import {
  supabaseGetWeeklyReports,
  supabaseUpsertWeeklyReport,
  supabaseDeleteWeeklyReportById,
} from './supabase'

let currentUserId = ''

// ---- Public API ----

export function setWeeklyReportUserId(userId: string) {
  currentUserId = userId
}

/** 从 Supabase 加载 */
export async function loadWeeklyReports(since?: string): Promise<WeeklyReport[]> {
  if (!currentUserId) return []
  return supabaseGetWeeklyReports(since)
}

/** 单条 upsert（fire-and-forget 云端写入） */
export function upsertWeeklyReport(report: WeeklyReport): void {
  supabaseUpsertWeeklyReport(report).catch(() => {})
}

/** 单条删除（fire-and-forget 云端写入） */
export function deleteWeeklyReportById(id: string): void {
  supabaseDeleteWeeklyReportById(id).catch(() => {})
}
