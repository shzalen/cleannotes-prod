<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { switchUser } from '@/services/storage'
import { mergeFromCloud } from '@/services/hybrid'
import { supabaseAdapter } from '@/services/supabase'
import { useSync, stopAllSync } from '@/composables/useSync'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { useTheme } from '@/composables/useTheme'
import { toUTCISO, toLocalDate } from '@/utils/time'
import XpToast from '@/components/XpToast.vue'
import BackToTop from '@/components/BackToTop.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const auth = useAuthStore()
const taskStore = useTaskStore()
const growthStore = useGrowthStore()
const router = useRouter()

// Initialize theme system
useTheme()

const { isOnline, syncStatus, lastSyncAt, formatLastSync } = useSync()

const showApp = computed(() => auth.isAuthenticated)

/** 一次性迁移：将旧「本地时间无 Z 后缀」格式转为标准 UTC ISO（带 Z）
 *  v4 迁移（UTC → 本地无Z）不再执行；现在统一为 UTC ISO + Z */
const MIGRATION_FLAG = 'cleannotes_time_migrated_v5'

async function runTimeMigration() {
  if (localStorage.getItem(MIGRATION_FLAG)) return

  const userId = auth.userId
  if (!userId) { markMigrated(); return }

  const tasksKey = `cleannotes_${userId}_tasks`
  const deletedKey = `cleannotes_${userId}_deleted_tasks`

  try {
    const raw = localStorage.getItem(tasksKey)
    if (!raw) { markMigrated(); return }

    const tasks: any[] = JSON.parse(raw)
    if (tasks.length === 0) { markMigrated(); return }

    // 检测旧格式：时间戳既不以 Z 结尾、也不含 +xx:xx → 是 toLocalISO 旧格式
    const needsFix = tasks.some((t: any) =>
      (t.createdAt && !t.createdAt.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(t.createdAt))
      || (t.updatedAt && !t.updatedAt.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(t.updatedAt))
      || (t.completedAt && !t.completedAt.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(t.completedAt))
    )

    if (needsFix) {
      // --- 转换全部任务时间戳为 UTC ISO（带 Z） ---
      const converted = tasks.map((t: any) => {
        const c: any = {
          ...t,
          createdAt: toUTCISO(new Date(t.createdAt)),
          updatedAt: toUTCISO(new Date(t.updatedAt)),
          completedAt: t.completedAt ? toUTCISO(new Date(t.completedAt)) : null,
          inProgressAt: t.inProgressAt ? toUTCISO(new Date(t.inProgressAt)) : null,
        }
        delete c.deletedAt
        return c
      })
      localStorage.setItem(tasksKey, JSON.stringify(converted))
      console.log(`[Migration v5] Converted ${converted.length} tasks to UTC ISO format`)
    } else {
      // 时间戳已是 UTC ISO 格式（带 Z）或已是本地格式但无 Z — 检查是否需要恢复
      supabaseAdapter.setUserId(userId)
      try {
        const cloudTasks = await supabaseAdapter.getTasks()
        if (cloudTasks.length > tasks.length) {
          console.log(`[Migration] Local has ${tasks.length} tasks, cloud has ${cloudTasks.length} — recovering`)
          const localMap = new Map(tasks.map((t: any) => [t.id, t]))
          const recovered: any[] = []
          for (const ct of cloudTasks) {
            const lt = localMap.get(ct.id)
            if (lt) {
              // Both exist — keep local (already in local format)
              recovered.push(lt)
            } else {
              // Cloud-only — convert to UTC ISO format
              recovered.push({
                ...ct,
                createdAt: toUTCISO(new Date(ct.createdAt)),
                updatedAt: toUTCISO(new Date(ct.updatedAt)),
                completedAt: ct.completedAt ? toUTCISO(new Date(ct.completedAt)) : null,
              })
            }
          }
          // Also keep any local-only tasks
          const cloudIds = new Set(cloudTasks.map((t: any) => t.id))
          for (const t of tasks) {
            if (!cloudIds.has(t.id)) {
              recovered.push(t)
            }
          }
          localStorage.setItem(tasksKey, JSON.stringify(recovered))
          console.log(`[Migration] Restored ${recovered.length} tasks from cloud`)
        }
      } catch (e) {
        console.warn('[Migration] Cloud recovery failed, keeping local data:', e)
      }
    }

    markMigrated()
  } catch {
    markMigrated()
  }
}

function markMigrated() {
  localStorage.setItem(MIGRATION_FLAG, '1')
}

/**
 * 从云端恢复可能因历史 bug 丢失的任务数据。
 * 当 localStorage 任务数明显少于云端时，合并云端数据到本地。
 * 此函数每次启动都运行（轻量：仅当本地 < 云端时才写入）。
 */
async function recoverSparseData(userId: string) {
  const tasksKey = `cleannotes_${userId}_tasks`
  try {
    const raw = localStorage.getItem(tasksKey)
    const localTasks: any[] = raw ? JSON.parse(raw) : []

    supabaseAdapter.setUserId(userId)
    const cloudTasks = await supabaseAdapter.getTasks().catch(() => [] as any[])

    if (cloudTasks.length <= localTasks.length) return

    console.log(`[Recover] Local ${localTasks.length} tasks vs cloud ${cloudTasks.length} — merging`)
    const localMap = new Map(localTasks.map((t: any) => [t.id, t]))
    const merged: any[] = []

    for (const ct of cloudTasks) {
      const lt = localMap.get(ct.id)
      if (lt) {
        merged.push(lt)  // keep local version (already in UTC ISO or user's latest)
      } else {
        merged.push({
          ...ct,
          createdAt: toUTCISO(new Date(ct.createdAt)),
          updatedAt: toUTCISO(new Date(ct.updatedAt)),
          completedAt: ct.completedAt ? toUTCISO(new Date(ct.completedAt)) : null,
        })
      }
    }
    // Keep local-only tasks (not yet synced to cloud)
    const cloudIds = new Set(cloudTasks.map((t: any) => t.id))
    for (const t of localTasks) {
      if (!cloudIds.has(t.id)) merged.push(t)
    }

    localStorage.setItem(tasksKey, JSON.stringify(merged))
    console.log(`[Recover] Restored to ${merged.length} tasks`)
  } catch (e) {
    console.warn('[Recover] Failed:', e)
  }
}

onMounted(async () => {
  await auth.init()
  if (auth.isAuthenticated && auth.userId) {
    switchUser(auth.userId)

    // --- 迁移：旧 UTC 时间戳 → 本地时间 ---
    await runTimeMigration()

    // --- 从云端恢复可能因历史 bug 丢失的数据 ---
    await recoverSparseData(auth.userId)

    // ① 加载本地数据到 store
    taskStore.load()
    growthStore.load()
    useGrowthIntegration()
    // ② 仅当无路由或从登录页进入时才跳转首页，刷新时保持当前页面
    const currentRoute = router.currentRoute.value
    if (!currentRoute.name || currentRoute.name === 'login') {
      router.push({ name: 'home' })
    }
    // ③ 后台异步合并云端数据；若有变更则刷新 store
    mergeFromCloud().then((changed) => {
      if (changed) taskStore.reload()
    })
  } else {
    router.push({ name: 'login' })
  }
})

function handleLogout() {
  stopAllSync()
  auth.logout()
  router.push({ name: 'login' })
}

// Global keyboard shortcut: Ctrl+Shift+D → open diag page
function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    router.push('/__diag')
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div v-if="showApp" class="app-shell">
    <AppSidebar
      :is-online="isOnline"
      :sync-status="syncStatus"
      :last-sync-text="formatLastSync(lastSyncAt)"
      @logout="handleLogout"
    />
    <main class="app-main">
      <router-view />
    </main>
    <XpToast />
    <BackToTop />
    <ConfirmDialog
      :visible="taskStore.reactivateConfirm.visible"
      title="重新激活任务"
      :message="`将已完成任务「<strong>${taskStore.reactivateConfirm.taskTitle}</strong>」重新激活为待办？<br/>激活后将保留历史耗时记录，重新开始执行时会刷新计时。`"
      confirm-text="确认激活"
      type="warning"
      @confirm="taskStore.confirmReactivate()"
      @cancel="taskStore.cancelReactivate()"
    />
  </div>
  <router-view v-else />
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-1);
}

.app-main {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>
