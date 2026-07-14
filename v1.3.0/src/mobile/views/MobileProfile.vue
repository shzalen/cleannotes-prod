<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useMemoStore } from '@/stores/memo'
import { useGrowthStore } from '@/stores/growth'
import { toLocalDate } from '@/utils/time'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { switchUser } from '@/services/storage'
import { flushPendingWrites, cleanupMemoStorage } from '@/services/memoStorage'
import { flushTaskWrites, cleanupTaskListeners, clearOnTaskDone } from '@/stores/task'
import { flushGrowthToCloud, cleanupGrowthStorage } from '@/services/growthStorage'
import { broadcastChange, closeCrossTabSync } from '@/services/crossTabSync'
import { clearAllLastSyncAt } from '@/services/syncState'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { ref } from 'vue'

const router = useRouter()
const auth = useAuthStore()
const taskStore = useTaskStore()
const memoStore = useMemoStore()
const growthStore = useGrowthStore()
const { mode, isDark } = useTheme()

const showLogoutConfirm = ref(false)

const today = toLocalDate()

const todayDone = computed(() =>
  taskStore.tasks.filter(t => t.completedAt?.startsWith(today) || (t.startDate === today && t.status === 'done')).length
)
const todayTotal = computed(() =>
  taskStore.tasks.filter(t => {
    if (t.startDate === today) return true
    if (t.startDate && t.startDate < today && t.status !== 'done') return true
    if (!t.startDate) {
      return t.createdAt.startsWith(today) || (t.createdAt.slice(0, 10) < today && t.status !== 'done')
    }
    return false
  }).length
)
const completionRate = computed(() => {
  if (todayTotal.value === 0) return 0
  return Math.round((todayDone.value / todayTotal.value) * 100)
})

const noteCount = computed(() => memoStore.memos.length)
const streakDays = computed(() => growthStore.state?.streakDays || 0)

const themeLabel = computed(() => {
  const labels: Record<ThemeMode, string> = {
    light: '浅色',
    dark: '深色',
    auto: '跟随系统',
    zuru: 'ZURU',
    tencent: '腾讯蓝',
  }
  return labels[mode.value] || '跟随系统'
})

function cycleTheme() {
  const order: ThemeMode[] = ['light', 'dark', 'auto']
  const idx = order.indexOf(mode.value)
  const next = order[(idx + 1) % order.length] || 'light'
  mode.value = next
  localStorage.setItem('cleannotes_theme', next)
}

function goToApp(route: string) {
  router.push(route)
}

async function handleLogout() {
  showLogoutConfirm.value = false
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
</script>

<template>
  <div class="profile-page safe-top">
    <header class="page-header">
      <h1 class="page-title">我的</h1>
    </header>

    <!-- Profile card -->
    <div class="profile-card" @click="goToApp('/app/settings')">
      <div class="avatar">
        {{ auth.user?.nickname?.[0]?.toUpperCase() || 'A' }}
      </div>
      <div class="profile-info">
        <div class="profile-name">{{ auth.user?.nickname || '用户' }}</div>
        <div class="profile-email">{{ auth.user?.email || '' }}</div>
      </div>
      <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="none">
        <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value" style="color: var(--color-primary)">{{ completionRate }}%</span>
        <span class="stat-label">完成率</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ noteCount }}</span>
        <span class="stat-label">笔记数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" style="color: #FF9500">{{ streakDays }}</span>
        <span class="stat-label">连续天数</span>
      </div>
    </div>

    <!-- Menu group 1 -->
    <div class="menu-group">
      <button class="menu-item" @click="cycleTheme">
        <div class="menu-icon" style="background: rgba(79,108,247,0.1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="12" cy="12" r="7" stroke="var(--color-primary)" stroke-width="2"/>
            <path d="M12 5A7 7 0 0 1 12 19Z" fill="var(--color-primary)"/>
          </svg>
        </div>
        <span class="menu-label">主题模式</span>
        <span class="menu-value">{{ themeLabel }}</span>
        <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="menu-divider" />

      <button class="menu-item" @click="goToApp('/app/settings')">
        <div class="menu-icon" style="background: rgba(255,149,0,0.1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M12 3V6M12 18V21M3 12H6M18 12H21M5.6 5.6L7.7 7.7M16.3 16.3L18.4 18.4M5.6 18.4L7.7 16.3M16.3 7.7L18.4 5.6" stroke="#FF9500" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="3" stroke="#FF9500" stroke-width="2"/>
          </svg>
        </div>
        <span class="menu-label">通知设置</span>
        <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="menu-divider" />

      <button class="menu-item">
        <div class="menu-icon" style="background: rgba(52,199,89,0.1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M4 12C4 7.6 7.6 4 12 4M20 12C20 16.4 16.4 20 12 20" stroke="#34C759" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 8L4 12L8 16M16 8L20 12L16 16" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="menu-label">数据同步</span>
        <span class="menu-value" style="color: #34C759">已同步</span>
        <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Menu group 2 -->
    <div class="menu-group">
      <button class="menu-item" @click="goToApp('/app/settings')">
        <div class="menu-icon" style="background: rgba(88,86,214,0.1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <rect x="6" y="10" width="12" height="10" rx="2" stroke="#5856D6" stroke-width="2"/>
            <path d="M9 10V7C9 5.34 10.34 4 12 4C13.66 4 15 5.34 15 7V10" stroke="#5856D6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="menu-label">账号安全</span>
        <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="menu-divider" />

      <button class="menu-item">
        <div class="menu-icon" style="background: rgba(142,142,147,0.1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#8E8E93" stroke-width="2"/>
            <path d="M12 8V12M12 16H12.01" stroke="#8E8E93" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="menu-label">关于清记</span>
        <span class="menu-value">v1.3.0</span>
        <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Logout button -->
    <button class="logout-btn" @click="showLogoutConfirm = true">
      退出登录
    </button>

    <!-- Logout confirm -->
    <ConfirmDialog
      :visible="showLogoutConfirm"
      title="退出登录"
      message="确定要退出登录吗？退出后需要重新登录才能使用。"
      confirm-text="退出"
      type="danger"
      @confirm="handleLogout"
      @cancel="showLogoutConfirm = false"
    />
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  padding-bottom: 80px;
}

.page-header {
  padding: 12px 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 16px 16px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: 16px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.profile-card:active {
  opacity: 0.7;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  font-size: 20px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
}

.profile-email {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.chevron {
  flex-shrink: 0;
}

.stats-row {
  display: flex;
  gap: 8px;
  margin: 0 16px 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 0;
  background: var(--color-surface);
  border-radius: 12px;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-1);
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-3);
}

.menu-group {
  margin: 0 16px 12px;
  background: var(--color-surface);
  border-radius: 14px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: opacity 0.15s;
}

.menu-item:active {
  opacity: 0.7;
}

.menu-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-size: 14px;
  color: var(--color-text-1);
}

.menu-value {
  font-size: 12px;
  color: var(--color-text-3);
}

.menu-divider {
  height: 0.5px;
  background: var(--color-border-light);
  margin: 0 16px 0 56px;
}

.logout-btn {
  display: block;
  width: calc(100% - 32px);
  margin: 16px;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.logout-btn:active {
  opacity: 0.7;
}
</style>
