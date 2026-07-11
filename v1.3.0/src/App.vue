<script setup lang="ts">
import { onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { useAiStore } from '@/stores/ai'
import { useTodoStore } from '@/stores/todo'
import { useMemoStore } from '@/stores/memo'
import { useWeeklyReportStore } from '@/stores/weeklyReport'
import { switchUser, isOnline, syncStatus, syncLogs } from '@/services/storage'
import { flushPendingWrites, cleanupMemoStorage } from '@/services/memoStorage'
import { flushTaskWrites, cleanupTaskListeners } from '@/stores/task'
import { flushGrowthToCloud } from '@/services/growthStorage'
import { onCrossTabSync, broadcastChange } from '@/services/crossTabSync'
import { clearAllLastSyncAt } from '@/services/syncState'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { useTheme } from '@/composables/useTheme'
import { isMobileDevice } from '@/utils/device'
import BackToTop from '@/components/BackToTop.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// Async components — only loaded after authentication, keeping login page lean
const AppSidebar = defineAsyncComponent(() => import('@/components/AppSidebar.vue'))
const XpToast = defineAsyncComponent(() => import('@/components/XpToast.vue'))

const auth = useAuthStore()
const taskStore = useTaskStore()
const growthStore = useGrowthStore()
const aiStore = useAiStore()
const todoStore = useTodoStore()
const memoStore = useMemoStore()
const weeklyReportStore = useWeeklyReportStore()
const router = useRouter()

// Initialize theme system
useTheme()

const showApp = computed(() => auth.isAuthenticated)

/** H5 移动端路由：不渲染 PC 侧栏，直接全屏展示 */
const isH5Route = computed(() => router.currentRoute.value.path.startsWith('/h5'))

// R5-P01: Store cross-tab sync unsubscribe for cleanup
let unsubCrossTab: (() => void) | null = null

onMounted(async () => {
  await auth.init()
  if (auth.isAuthenticated && auth.userId) {
    switchUser(auth.userId)

    // 从 Supabase 加载所有数据
    await Promise.all([
      taskStore.load(),
      growthStore.load(),
      aiStore.load(),
      todoStore.load(),
      memoStore.load(),
      weeklyReportStore.load(),
    ])
    useGrowthIntegration()

    // Cross-tab sync: reload stores when other tabs write data
    // R5-P01: Capture unsubscribe function for cleanup
    unsubCrossTab = onCrossTabSync((msg) => {
      switch (msg.type) {
        case 'tasks-updated': taskStore.reload().catch(() => {}); break
        case 'memos-updated': memoStore.load(true).catch(() => {}); break
        case 'todos-updated': todoStore.load(true).catch(() => {}); break
        case 'growth-updated': growthStore.load(true).catch(() => {}); break
        case 'reports-updated': weeklyReportStore.load(true).catch(() => {}); break
        case 'logout':
          // S-14: Another tab logged out — redirect this tab to login too
          clearAllLastSyncAt()
          router.push({ name: 'login' })
          break
      }
    })

    // 检查 H5 重定向（未登录访问 H5 页面 → 登录后跳回）
    const h5Redirect = sessionStorage.getItem('h5_redirect')
    if (h5Redirect) {
      sessionStorage.removeItem('h5_redirect')
      router.push(h5Redirect)
    } else {
      const currentRoute = router.currentRoute.value
      if (!currentRoute.name || currentRoute.name === 'login') {
        if (isMobileDevice()) {
          router.push('/h5/tasks')
        } else {
          router.push({ name: 'home' })
        }
      }
    }
  } else {
    router.push({ name: 'login' })
  }
})

async function handleLogout() {
  // Flush any pending writes before clearing user context
  await flushPendingWrites()
  flushTaskWrites()
  // R4-P01: Flush growth data (XP/achievements/state) before logout —
  // growthStorage uses 2s debounced sync, so pending changes may not be saved
  await flushGrowthToCloud()
  clearAllLastSyncAt()
  // S-14: Broadcast logout to other tabs before clearing local state
  broadcastChange('logout')
  // R3-P02: cleanupMemoStorage clears interval + event listeners
  cleanupMemoStorage()
  // R4-P02: cleanupTaskListeners removes module-level visibilitychange listener
  cleanupTaskListeners()
  // R4-P04: Unsubscribe Supabase Auth state listener
  auth.cleanup()
  auth.logout()
  // R3-P02+P04: Force page reload to clear all Pinia store data (prevents
  // cross-user data residue) and re-register cross-tab sync listener
  window.location.href = '/login'
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
  // R5-P01: Unsubscribe cross-tab sync listener
  if (unsubCrossTab) unsubCrossTab()
})
</script>

<template>
  <div v-if="showApp && !isH5Route" class="app-shell">
    <AppSidebar
      :is-online="isOnline"
      :sync-status="syncStatus"
      last-sync-text=""
      :sync-logs="syncLogs"
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
