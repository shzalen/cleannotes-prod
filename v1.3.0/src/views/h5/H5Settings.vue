<template>
  <div class="h5-page">
    <!-- 顶部头部 -->
    <header class="h5-header">
      <div class="h5-header-bg"></div>
      <div class="h5-header-content">
        <h1 class="h5-title">设置</h1>
      </div>
    </header>

    <!-- 用户信息 -->
    <div class="h5-user-card" v-if="auth.user">
      <div class="h5-user-avatar">
        {{ (auth.user.nickname || auth.user.phone || '?').charAt(0).toUpperCase() }}
      </div>
      <div class="h5-user-info">
        <div class="h5-user-name">{{ auth.user.nickname || '未设置昵称' }}</div>
        <div class="h5-user-phone">{{ auth.user.phone }}</div>
      </div>
    </div>

    <!-- 皮肤设置 -->
    <div class="h5-section">
      <div class="h5-section-title">皮肤主题</div>
      <div class="h5-theme-grid">
        <button
          v-for="theme in themes"
          :key="theme.value"
          class="h5-theme-card"
          :class="{ active: mode === theme.value }"
          @click="setTheme(theme.value)"
        >
          <div class="h5-theme-preview" :class="`preview-${theme.value}`">
            <div class="h5-preview-bar"></div>
            <div class="h5-preview-dot"></div>
            <div class="h5-preview-line"></div>
            <div class="h5-preview-line short"></div>
          </div>
          <div class="h5-theme-label">{{ theme.label }}</div>
          <div class="h5-theme-check" v-if="mode === theme.value">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        </button>
      </div>
    </div>

    <!-- 功能选项 -->
    <div class="h5-section">
      <div class="h5-section-title">更多</div>
      <div class="h5-menu-list">
        <div class="h5-menu-item" @click="goPC">
          <div class="h5-menu-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <span class="h5-menu-text">切换到桌面版</span>
          <svg class="h5-menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="h5-menu-item" @click="onLogout">
          <div class="h5-menu-icon danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </div>
          <span class="h5-menu-text danger">退出登录</span>
          <svg class="h5-menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>

    <!-- 版本信息 -->
    <div class="h5-version">
      清记 H5 · v{{ appVersion }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import type { ThemeMode } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { setForcePC } from '@/utils/device'

const { mode, setTheme } = useTheme()
const auth = useAuthStore()
const router = useRouter()

const appVersion = __APP_VERSION__ || '1.3.0'

const themes: { label: string; value: ThemeMode }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' },
  { label: 'ZURU', value: 'zuru' },
  { label: '腾讯蓝', value: 'tencent' },
]

function goPC() {
  // 设置强制桌面版标记，阻止路由守卫自动跳回 H5
  // 用户再次进入 /h5/* 时会自动清除该标记
  setForcePC()
  router.push('/')
}

function onLogout() {
  if (!confirm('确定退出登录？')) return
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.h5-page {
  min-height: 100%;
  padding-bottom: 40px;
}

/* 顶部头部 */
.h5-header {
  position: relative;
  padding: 12px 20px 16px;
  overflow: hidden;
}

.h5-header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  opacity: 0.08;
}

.h5-header-content {
  position: relative;
  z-index: 1;
}

.h5-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -0.5px;
}

/* 用户卡片 */
.h5-user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 16px 24px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 1px 4px var(--color-shadow);
}

.h5-user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}

.h5-user-info {
  flex: 1;
  min-width: 0;
}

.h5-user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.h5-user-phone {
  font-size: 13px;
  color: var(--color-text-3);
  margin-top: 2px;
}

/* 设置区块 */
.h5-section {
  margin: 0 16px 24px;
}

.h5-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-3);
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  padding-left: 4px;
}

/* 主题选择 */
.h5-theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.h5-theme-card {
  position: relative;
  border: 2px solid var(--color-border);
  border-radius: 14px;
  padding: 12px 8px 10px;
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-theme-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.h5-theme-preview {
  height: 60px;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

/* 主题预览样式 */
.preview-light { background: #f8f9fc; }
.preview-light .h5-preview-bar { background: #4f6cf7; }
.preview-light .h5-preview-dot { background: #4f6cf7; }
.preview-light .h5-preview-line { background: #e2e8f0; }

.preview-dark { background: #0f1115; }
.preview-dark .h5-preview-bar { background: #6b81f8; }
.preview-dark .h5-preview-dot { background: #6b81f8; }
.preview-dark .h5-preview-line { background: #2e3038; }

.preview-auto { background: linear-gradient(135deg, #f8f9fc 50%, #0f1115 50%); }
.preview-auto .h5-preview-bar { background: #4f6cf7; }
.preview-auto .h5-preview-dot { background: #4f6cf7; }
.preview-auto .h5-preview-line { background: #e2e8f0; }

.preview-zuru { background: #F1F3F6; }
.preview-zuru .h5-preview-bar { background: #CB312D; }
.preview-zuru .h5-preview-dot { background: #CB312D; }
.preview-zuru .h5-preview-line { background: #DFE2E6; }

.preview-tencent { background: #EDF1FF; }
.preview-tencent .h5-preview-bar { background: #0052D9; }
.preview-tencent .h5-preview-dot { background: #0052D9; }
.preview-tencent .h5-preview-line { background: #D4DBF0; }

.h5-preview-bar {
  height: 4px;
  width: 60%;
  border-radius: 2px;
}

.h5-preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.h5-preview-line {
  height: 3px;
  border-radius: 2px;
}

.h5-preview-line.short {
  width: 50%;
}

.h5-theme-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  text-align: center;
}

.h5-theme-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 菜单列表 */
.h5-menu-list {
  background: var(--color-surface);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 4px var(--color-shadow);
}

.h5-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-menu-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

.h5-menu-item:active {
  background: var(--color-bg-2);
}

.h5-menu-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.h5-menu-icon.danger {
  background: var(--color-danger-light);
  color: var(--color-danger-text);
}

.h5-menu-text {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-1);
}

.h5-menu-text.danger {
  color: var(--color-danger-text);
}

.h5-menu-arrow {
  color: var(--color-text-4);
  flex-shrink: 0;
}

/* 版本信息 */
.h5-version {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-4);
  margin-top: 32px;
}
</style>
