<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'
import { stopAllSync } from '@/composables/useSync'
import { marked } from 'marked'
import type { SyncLogEntry } from '@/services/hybrid'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TestReportModal from '@/components/TestReportModal.vue'
import SyncLogModal from '@/components/SyncLogModal.vue'

const props = defineProps<{
  isOnline?: boolean
  syncStatus?: 'idle' | 'syncing' | 'error'
  lastSyncText?: string
  syncLogs?: SyncLogEntry[]
}>()

const emit = defineEmits<{
  logout: []
}>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
const appVersion = __APP_VERSION__
const buildTime = __BUILD_TIME__

const logoutVisible = ref(false)
const testReportVisible = ref(false)
const readmeVisible = ref(false)
const readmeHtml = ref('')
const isReadmeFullscreen = ref(false)
const syncLogVisible = ref(false)

// 最近3条同步日志
const recentSyncLogs = computed(() => (props.syncLogs || []).slice(0, 3))

function formatLogTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60_000) return '刚刚'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function toggleSyncLog() {
  syncLogVisible.value = !syncLogVisible.value
}

function toggleReadmeFs() {
  isReadmeFullscreen.value = !isReadmeFullscreen.value
}

function onReadmeKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && readmeVisible.value) {
    if (isReadmeFullscreen.value) {
      isReadmeFullscreen.value = false
    } else {
      readmeVisible.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onReadmeKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onReadmeKeydown)
})

async function showReadme() {
  readmeVisible.value = true
  if (!readmeHtml.value) {
    try {
      const res = await fetch('/readme.txt')
      const md = await res.text()
      readmeHtml.value = await marked.parse(md)
    } catch {
      readmeHtml.value = '<p>无法加载 README</p>'
    }
  }
}

const navItems = [
  { name: 'home', path: '/', icon: 'home', label: '首页' },
  { name: 'tasks', path: '/tasks', icon: 'tasks', label: '工作任务' },
  { name: 'todos', path: '/todos', icon: 'todos', label: '待办事项' },
  { name: 'memos', path: '/memos', icon: 'memos', label: '备忘录' },
  { name: 'reports', path: '/reports', icon: 'reports', label: '周报' },
  { name: 'ai', path: '/ai', icon: 'editor', label: 'AI 助手' },
  { name: 'settings', path: '/settings', icon: 'settings', label: '设置' },
]

const activeNav = computed(() => route.name as string)

const online = computed(() => props.isOnline ?? true)
const syncing = computed(() => props.syncStatus === 'syncing')
const statusLabel = computed(() => {
  if (syncing.value) return '同步中...'
  return online.value ? '在线同步' : '离线模式'
})

const displayName = computed(() => {
  return auth.user?.nickname || auth.user?.phone?.slice(-4) || '用户'
})

const displayPhone = computed(() => {
  const p = auth.user?.phone || ''
  if (p.length >= 11) return p.slice(0, 3) + '****' + p.slice(7)
  return p
})

function navigate(path: string) {
  router.push(path)
}

function handleLogout() {
  logoutVisible.value = true
}

function confirmLogout() {
  stopAllSync()
  auth.logout()
  switchUser('')
  router.push({ name: 'login' })
  logoutVisible.value = false
  emit('logout')
}
</script>

<template>
  <aside class="sidebar">
    <!-- Brand -->
    <div class="sidebar-brand" @click="navigate('/')">
      <div class="brand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="brand-text">
        <div class="brand-title">Clean Notepad</div>
      </div>
    </div>

    <!-- User Card -->
    <div class="user-card">
      <div class="user-avatar">{{ displayName.charAt(0) }}</div>
      <div class="user-info">
        <div class="user-name">{{ displayName }}</div>
        <div class="user-phone">{{ displayPhone }}</div>
      </div>
      <button class="logout-btn" title="退出登录" @click="handleLogout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Nav -->
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        :class="['nav-item', { active: activeNav === item.name }]"
        @click="navigate(item.path)"
      >
        <!-- Home -->
        <svg v-if="item.icon === 'home'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <!-- Tasks -->
        <svg v-else-if="item.icon === 'tasks'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <!-- Todos -->
        <svg v-else-if="item.icon === 'todos'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <!-- Memos -->
        <svg v-else-if="item.icon === 'memos'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <!-- Reports / 周报 — 日历图标 -->
        <svg v-else-if="item.icon === 'reports'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- 日历主体 -->
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <!-- 顶部横条（月份区域） -->
          <line x1="3" y1="10" x2="21" y2="10"/>
          <!-- 左右挂耳 -->
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <!-- 日期网格（3×2，传达"周"的感受） -->
          <rect x="7"  y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>
          <rect x="12" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>
          <rect x="7"  y="18" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>
          <rect x="12" y="18" width="3" height="3" rx="0.5" fill="none"   stroke="currentColor"/>
        </svg>
        <!-- Editor / AI -->
        <svg v-else-if="item.icon === 'editor'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <!-- Settings -->
        <svg v-else-if="item.icon === 'settings'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>

    <!-- Bottom -->
    <div class="sidebar-bottom">
      <div class="status-row">
        <div class="status-dot" :class="{ online: online, syncing: syncing }" :title="statusLabel" />
        <span class="status-text">{{ statusLabel }}</span>
        <span v-if="lastSyncText && online && !syncing" class="status-time" @click.stop="toggleSyncLog">{{ lastSyncText }}</span>
      </div>
      <div class="version-row" @click="testReportVisible = true" title="查看测试报告">v{{ appVersion }} · {{ buildTime }}</div>
      <div class="readme-row" @click="showReadme">README</div>
    </div>
  </aside>

  <!-- Logout confirm -->
  <ConfirmDialog
    :visible="logoutVisible"
    title="退出登录"
    message="确定要退出登录吗？"
    confirm-text="退出"
    type="warning"
    @confirm="confirmLogout"
    @cancel="logoutVisible = false"
  />

  <!-- Test Report Modal -->
  <TestReportModal
    :visible="testReportVisible"
    :current-version="appVersion"
    @close="testReportVisible = false"
  />

  <!-- Sync Log Modal -->
  <SyncLogModal
    :visible="syncLogVisible"
    @close="syncLogVisible = false"
  />

  <!-- README Modal -->
  <Teleport to="body">
    <div v-if="readmeVisible" class="readme-overlay" @click.self="isReadmeFullscreen ? null : readmeVisible = false">
      <div class="readme-modal" :class="{ fullscreen: isReadmeFullscreen }">
        <div class="readme-header">
          <span class="readme-title">README</span>
          <div class="readme-header-actions">
            <button class="readme-fs-btn" @click="toggleReadmeFs" :title="isReadmeFullscreen ? '退出全屏' : '全屏查看'">
              <!-- maximize icon -->
              <svg v-if="!isReadmeFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <!-- minimize / restore icon -->
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 8 4 3 9 3"/><polyline points="20 16 20 21 15 21"/><line x1="4" y1="3" x2="10" y2="9"/><line x1="20" y1="21" x2="14" y2="15"/>
              </svg>
            </button>
            <button class="readme-close" @click="readmeVisible = false; isReadmeFullscreen = false" title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="readme-body" v-html="readmeHtml"></div>
      </div>
    </div>
  </Teleport>

  <!-- Sync Log Popup -->
  <Teleport to="body">
    <div v-if="syncLogVisible" class="sync-log-overlay" @click="syncLogVisible = false">
      <div class="sync-log-popup" @click.stop>
        <div class="sync-log-header">
          <span class="sync-log-title">同步记录</span>
          <button class="sync-log-close" @click="syncLogVisible = false" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="sync-log-body">
          <template v-if="recentSyncLogs.length > 0">
            <div v-for="log in recentSyncLogs" :key="log.id" class="sync-log-item">
              <span class="sync-log-dot" :class="log.status" />
              <span class="sync-log-msg">{{ log.message }}</span>
              <span class="sync-log-time">{{ formatLogTime(log.time) }}</span>
            </div>
          </template>
          <div v-else class="sync-log-empty">暂无同步记录</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar {
  width: 220px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Brand */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  margin-bottom: 16px;
  cursor: pointer;
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-success-light);
  color: var(--color-success-text);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-1);
  line-height: 1.2;
}

/* User Card */
.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 20px;
  margin-top: 4px;
  background: var(--color-bg-3);
  border-radius: 12px;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-success), var(--color-success-text));
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-phone {
  font-size: 11px;
  color: var(--color-text-3);
  line-height: 1.2;
}

.logout-btn {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.logout-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-danger);
}

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  color: var(--color-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.nav-item:hover {
  background: var(--color-bg-4);
  color: var(--color-text-2);
}

.nav-item.active {
  background: var(--color-success-light);
  color: var(--color-success-text);
}

.nav-label {
  line-height: 1;
}

/* Bottom */
.sidebar-bottom {
  margin-top: auto;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 4px 0;
  border-top: 1px solid var(--color-bg-4);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-text-4);
  transition: background 0.3s ease;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--color-success);
}

.status-dot.syncing {
  background: var(--color-warning);
  animation: pulse 1.2s infinite;
}

.status-text {
  font-size: 11px;
  color: var(--color-text-3);
}

.status-time {
  font-size: 10px;
  color: var(--color-text-4);
  margin-left: auto;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.status-time:hover {
  background: var(--color-bg-4);
  color: var(--color-text-3);
}

.version-row {
  font-size: 10px;
  color: var(--color-text-4);
  padding: 2px 4px 0;
  opacity: 0.5;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.version-row:hover {
  opacity: 0.8;
}

.readme-row {
  font-size: 9px;
  color: var(--color-text-4);
  padding: 2px 4px 0;
  opacity: 0.35;
  cursor: pointer;
  transition: opacity 0.15s;
}

.readme-row:hover {
  opacity: 0.7;
}

/* README Modal */
.readme-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s;
}

.readme-modal {
  width: 720px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.15s;
}

.readme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.readme-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.readme-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--color-text-3);
  cursor: pointer;
  transition: all 0.15s;
}

.readme-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.readme-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.readme-fs-btn {
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.readme-fs-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

/* Fullscreen mode */
.readme-modal.fullscreen {
  width: 100vw !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  height: 100vh !important;
  border-radius: 0;
  box-shadow: none;
}

.readme-modal.fullscreen .readme-body {
  padding: 28px 40px;
  flex: 1;
}

.readme-body {
  padding: 24px 28px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-1);
}

.readme-body :deep(h1) {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.readme-body :deep(h2) {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-top: 24px;
  margin-bottom: 8px;
}

.readme-body :deep(h3) {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-top: 16px;
  margin-bottom: 6px;
}

.readme-body :deep(p) {
  margin-bottom: 8px;
}

.readme-body :deep(ul) {
  padding-left: 20px;
  margin-bottom: 8px;
}

.readme-body :deep(li) {
  margin-bottom: 2px;
  color: var(--color-text-1);
}

.readme-body :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  background: var(--color-bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  color: #c7254e;
}

.readme-body :deep(pre) {
  background: var(--color-bg-hover);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 12px;
}

.readme-body :deep(pre code) {
  background: none;
  padding: 0;
  color: #333;
}

[data-theme="dark"] .readme-body :deep(pre code),
[data-theme="zuru"] .readme-body :deep(pre code) {
  color: #e0e0e0;
}

.readme-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 13px;
}

.readme-body :deep(th),
.readme-body :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--color-border-light);
}

.readme-body :deep(th) {
  background: var(--color-bg-hover);
  font-weight: 600;
  color: var(--color-text-1);
}

.readme-body :deep(td) {
  color: var(--color-text-1);
}

.readme-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: 16px 0;
}

.readme-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.readme-body :deep(a:hover) {
  text-decoration: underline;
}

.readme-body :deep(strong) {
  font-weight: 600;
  color: var(--color-text-1);
}

/* Sync Log Popup */
.sync-log-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
}

.sync-log-popup {
  position: absolute;
  bottom: 42px;
  left: 224px;
  width: 260px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  animation: popIn 0.15s ease;
}

.sync-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}

.sync-log-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
}

.sync-log-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--color-text-4);
  cursor: pointer;
  transition: all 0.15s;
}

.sync-log-close:hover {
  background: var(--color-bg-4);
  color: var(--color-text-2);
}

.sync-log-body {
  padding: 6px 0;
  max-height: 180px;
  overflow-y: auto;
}

.sync-log-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
}

.sync-log-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-text-4);
}

.sync-log-dot.success {
  background: var(--color-success);
}

.sync-log-dot.error {
  background: var(--color-danger);
}

.sync-log-dot.idle {
  background: var(--color-text-4);
}

.sync-log-msg {
  flex: 1;
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-log-time {
  font-size: 11px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.sync-log-empty {
  padding: 16px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-4);
}

@keyframes popIn {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ============ Keyframes ============ */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
