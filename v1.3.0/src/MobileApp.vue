<script setup lang="ts">
import { onMounted, onUnmounted, provide } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useTodoStore } from '@/stores/todo'
import { useMemoStore } from '@/stores/memo'
import { useGrowthStore } from '@/stores/growth'
import { useAiStore } from '@/stores/ai'
import { useWeeklyReportStore } from '@/stores/weeklyReport'
import { switchUser } from '@/services/storage'
import { flushTaskWrites, cleanupTaskListeners, clearOnTaskDone } from '@/stores/task'
import { flushPendingWrites, cleanupMemoStorage } from '@/services/memoStorage'
import { flushGrowthToCloud, cleanupGrowthStorage } from '@/services/growthStorage'
import { onCrossTabSync, broadcastChange, closeCrossTabSync } from '@/services/crossTabSync'
import { clearAllLastSyncAt } from '@/services/syncState'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { useTheme } from '@/composables/useTheme'

const auth = useAuthStore()
const taskStore = useTaskStore()
const todoStore = useTodoStore()
const memoStore = useMemoStore()
const growthStore = useGrowthStore()
const aiStore = useAiStore()
const weeklyReportStore = useWeeklyReportStore()
const router = useRouter()

// Apply theme system (sets data-theme on document)
useTheme()

let unsubCrossTab: (() => void) | null = null

onMounted(async () => {
  await auth.init()

  if (auth.isAuthenticated && auth.userId) {
    switchUser(auth.userId)

    // Load all stores in parallel
    await Promise.all([
      taskStore.load(),
      todoStore.load(),
      memoStore.load(),
      growthStore.load(),
      aiStore.load(),
      weeklyReportStore.load(),
    ])

    useGrowthIntegration()

    // Cross-tab sync
    unsubCrossTab = onCrossTabSync((msg) => {
      switch (msg.type) {
        case 'tasks-updated': taskStore.reload().catch(() => {}); break
        case 'memos-updated': memoStore.load(true).catch(() => {}); break
        case 'todos-updated': todoStore.load(true).catch(() => {}); break
        case 'growth-updated': growthStore.load(true).catch(() => {}); break
        case 'reports-updated': weeklyReportStore.load(true).catch(() => {}); break
        case 'logout':
          clearAllLastSyncAt()
          router.push({ name: 'login' })
          break
      }
    })
  }
})

async function handleLogout() {
  await flushPendingWrites()
  flushTaskWrites()
  await flushGrowthToCloud()
  cleanupGrowthStorage()
  clearAllLastSyncAt()
  broadcastChange('logout')
  closeCrossTabSync()
  cleanupMemoStorage()
  cleanupTaskListeners()
  clearOnTaskDone()
  auth.cleanup()
  auth.logout()
  window.location.hash = '#/login'
  window.location.reload()
}

onUnmounted(() => {
  if (unsubCrossTab) unsubCrossTab()
})

// Provide logout to child components
provide('appLogout', handleLogout)
</script>

<template>
  <router-view />
</template>
