/**
 * Weekly Report Storage — 离线优先（localStorage + Supabase 同步）
 *
 * 写操作：先写 localStorage，再异步写 Supabase
 * 读操作：从 localStorage 读取
 * 同步：login 后从 Supabase 拉取云端数据合并到本地
 */

import type { WeeklyReport } from '@/types'
import {
  supabaseGetWeeklyReports,
  supabaseUpsertWeeklyReport,
  supabaseDeleteWeeklyReportById,
} from './supabase'

let currentUserId = ''

function prefix(): string {
  return currentUserId
    ? `cleannotes_${currentUserId}_weekly_reports`
    : `cleannotes_weekly_reports`
}

function readReports(): WeeklyReport[] {
  try {
    const raw = localStorage.getItem(prefix())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeReports(reports: WeeklyReport[]): void {
  localStorage.setItem(prefix(), JSON.stringify(reports))
}

// ---- Public API ----

export function setWeeklyReportUserId(userId: string) {
  currentUserId = userId
}

/** 从 localStorage 加载 */
export function loadWeeklyReports(): WeeklyReport[] {
  return readReports()
}

/** 全量保存到本地 */
export function saveWeeklyReports(reports: WeeklyReport[]): void {
  writeReports(reports)
}

/** 单条 upsert（本地 + 后台云端） */
export function upsertWeeklyReport(report: WeeklyReport): void {
  const reports = readReports()
  const idx = reports.findIndex(r => r.id === report.id)
  if (idx === -1) {
    reports.push(report)
  } else {
    reports[idx] = report
  }
  writeReports(reports)

  // 后台异步同步到 Supabase
  supabaseUpsertWeeklyReport(report).catch(() => {})
}

/** 单条删除（本地 + 后台云端） */
export function deleteWeeklyReportById(id: string): void {
  const reports = readReports().filter(r => r.id !== id)
  writeReports(reports)

  // 后台异步同步到 Supabase
  supabaseDeleteWeeklyReportById(id).catch(() => {})
}

/** 从 Supabase 拉取并合并到本地 */
export async function syncWeeklyReportsFromCloud(): Promise<void> {
  try {
    const cloudData = await supabaseGetWeeklyReports()
    if (cloudData.length === 0) return

    const local = readReports()
    const localMap = new Map(local.map(r => [r.id, r]))

    for (const cloud of cloudData) {
      const localItem = localMap.get(cloud.id)
      if (!localItem || cloud.updatedAt >= localItem.updatedAt) {
        localMap.set(cloud.id, cloud)
      }
    }

    writeReports(Array.from(localMap.values()))
  } catch {
    // 静默失败，留待下次同步
  }
}
