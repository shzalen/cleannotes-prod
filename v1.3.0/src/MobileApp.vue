<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useGrowthStore } from '@/stores/growth'
import { useAiStore } from '@/stores/ai'
import { useTodoStore } from '@/stores/todo'
import { useMemoStore } from '@/stores/memo'
import { useWeeklyReportStore } from '@/stores/weeklyReport'
import { switchUser } from '@/services/storage'
import { flushPendingWrites, cleanupMemoStorage } from '@/services/memoStorage'
import { flushTaskWrites, cleanupTaskListeners, clearOnTaskDone } from '@/stores/task'
import { flushGrowthToCloud, cleanupGrowthStorage } from '@/services/growthStorage'
import { onCrossTabSync, broadcastChange, closeCrossTabSync } from '@/services/crossTabSync'
import { clearAllLastSyncAt } from '@/services/syncState'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { useTheme } from '@/composables/useTheme'

const auth = useAuthStore()
const taskStore = useTaskStore()
const growthStore = useGrowthStore()
const aiStore = useAiStore()
const todoStore = useTodoStore()
const memoStore = useMemoStore()
const weeklyReportStore = useWeeklyReportStore()
const router = useRouter()

useTheme()

const showApp = computed(() => auth.isAuthenticated)

let unsubCrossTab: (() => void) | null = null

onMounted(async () => {
  await auth.init()
  if (auth.isAuthenticated && auth.userId) {
    switchUser(auth.userId)
    await Promise.all([
      taskStore.load(),
      growthStore.load(),
      aiStore.load(),
      todoStore.load(),
      memoStore.load(),
      weeklyReportStore.load(),
    ])
    useGrowthIntegration()

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

    if (router.currentRoute.value.name === 'login' || !router.currentRoute.value.name) {
      router.push({ name: 'home' })
    }
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

// Expose logout globally for child components
defineExpose({ handleLogout })
</script>

<template>
  <router-view v-if="showApp" />
  <router-view v-else />
</template>
