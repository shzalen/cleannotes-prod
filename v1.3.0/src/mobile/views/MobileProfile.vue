<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const auth = useAuthStore()
const taskStore = useTaskStore()
const showLogoutConfirm = ref(false)
const clearingCache = ref(false)

const email = computed(() => auth.user?.email || '')
const namePrefix = computed(() => (email.value?.[0] || 'U').toUpperCase())
const taskCount = computed(() => taskStore.tasks.length)
const doneCount = computed(() => taskStore.doneTasks.length)

function goToApp(route: string) {
  router.push(route)
}

async function handleClearCache() {
  clearingCache.value = true
  try {
    // 清除所有 Service Worker 缓存
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    // 注销 Service Worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    // 清除 localStorage 中的缓存标记
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('cache') || key.includes('lastSync') || key.includes('sync'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
    // 强制刷新
    window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now()
  } catch {
    window.location.reload()
  }
}

async function handleLogout() {
  showLogoutConfirm.value = false
  await auth.logout()
  window.location.reload()
}
</script>

<template>
  <div class="profile-page safe-top">
    <!-- Header -->
    <header class="page-header">
      <h1 class="page-title">我的</h1>
    </header>

    <!-- User card -->
    <div class="user-card">
      <div class="avatar">
        {{ namePrefix }}
      </div>
      <div class="user-info">
        <p class="user-name">{{ email || '未登录' }}</p>
        <p class="user-badge">已登录</p>
      </div>
      <svg class="user-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none">
        <path d="M9 6L15 12L9 18" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ taskCount }}</span>
        <span class="stat-label">全部任务</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ doneCount }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" style="color: var(--color-primary)">
          {{ taskCount ? Math.round((doneCount / taskCount) * 100) : 0 }}%
        </span>
        <span class="stat-label">完成率</span>
      </div>
    </div>

    <!-- Menu group 1: Data -->
    <div class="menu-group">
      <button class="menu-item">
        <div class="menu-icon-wrapper" style="background: rgba(52, 199, 89, 0.1)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#34C759" stroke-width="2"/>
            <path d="M8 12L11 15L16 9" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="menu-label">数据同步</span>
        <span class="menu-value sync">已同步</span>
      </button>

      <div class="menu-divider" />

      <button class="menu-item" @click="goToApp('/app/settings')">
        <div class="menu-icon-wrapper" style="background: rgba(88, 86, 214, 0.1)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <rect x="6" y="10" width="12" height="10" rx="2" stroke="#5856D6" stroke-width="2"/>
            <path d="M9 10V7C9 5.34 10.34 4 12 4C13.66 4 15 5.34 15 7V10" stroke="#5856D6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="menu-label">账号安全</span>
      </button>
    </div>

    <!-- Menu group 2: About -->
    <div class="menu-group">
      <button class="menu-item">
        <div class="menu-icon-wrapper" style="background: rgba(142, 142, 147, 0.1)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#8E8E93" stroke-width="2"/>
            <path d="M12 8V12M12 16H12.01" stroke="#8E8E93" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="menu-label">关于清记</span>
        <span class="menu-value">v1.3.0</span>
      </button>
    </div>

    <!-- Logout -->
    <button class="logout-btn" @click="showLogoutConfirm = true">
      退出登录
    </button>

    <!-- Clear cache -->
    <button class="clear-cache-btn" :disabled="clearingCache" @click="handleClearCache">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" class="clear-icon">
        <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {{ clearingCache ? '清理中...' : '清除缓存' }}
    </button>

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
  padding: 20px 20px 16px;
}

.page-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -0.5px;
}

/* ===== User card ===== */
.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 16px 20px;
  padding: 20px;
  background: var(--color-surface);
  border-radius: 18px;
  border: 1px solid var(--color-border-light);
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-badge {
  font-size: 13px;
  color: var(--color-success-text);
  margin: 4px 0 0;
  font-weight: 500;
}

.user-arrow {
  flex-shrink: 0;
}

/* ===== Stats ===== */
.stats-row {
  display: flex;
  gap: 10px;
  margin: 0 16px 20px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 0;
  background: var(--color-surface);
  border-radius: 16px;
  border: 1px solid var(--color-border-light);
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-3);
  font-weight: 500;
}

/* ===== Menu ===== */
.menu-group {
  margin: 0 16px 14px;
  background: var(--color-surface);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
}

.menu-item:active {
  background: var(--color-bg-2);
}

.menu-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-size: 16px;
  color: var(--color-text-1);
  font-weight: 400;
}

.menu-value {
  font-size: 14px;
  color: var(--color-text-3);
}

.menu-value.sync {
  color: #34C759;
  font-weight: 500;
}

.menu-divider {
  height: 0.5px;
  background: var(--color-separator);
  margin: 0 18px 0 64px;
}

/* ===== Logout ===== */
.logout-btn {
  display: block;
  width: calc(100% - 32px);
  margin: 20px 16px;
  padding: 15px;
  border: none;
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border-light);
  transition: background 0.15s;
}

.logout-btn:active {
  background: var(--color-bg-2);
}

/* ===== Clear cache ===== */
.clear-cache-btn {
  display: block;
  width: calc(100% - 32px);
  margin: 8px 16px 20px;
  padding: 13px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--color-text-3);
  font-size: 15px;
  font-weight: 400;
  cursor: pointer;
  transition: color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.clear-cache-btn:active:not(:disabled) {
  color: var(--color-text-2);
}

.clear-cache-btn:disabled {
  opacity: 0.5;
}

.clear-icon {
  opacity: 0.6;
}
</style>
