<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { flushTaskWrites, cleanupTaskListeners, clearOnTaskDone } from '@/stores/task'
import { flushPendingWrites, cleanupMemoStorage } from '@/services/memoStorage'
import { flushGrowthToCloud, cleanupGrowthStorage } from '@/services/growthStorage'
import { clearAllLastSyncAt } from '@/services/syncState'
import { broadcastChange, closeCrossTabSync } from '@/services/crossTabSync'
import { showConfirmDialog, showToast } from 'vant'

defineOptions({ name: 'MobileProfile' })

const auth = useAuthStore()
const { mode, setTheme } = useTheme()

const nickname = computed(() => auth.user?.nickname || '用户')
const email = computed(() => auth.user?.email || '')

// ── 主题选项 ──
const themeOptions: { label: string; value: ThemeMode; desc: string }[] = [
  { label: '腾讯蓝', value: 'tencent', desc: '默认主题' },
  { label: 'ZURU', value: 'zuru', desc: '品牌红' },
  { label: '暗黑', value: 'dark', desc: '深色模式' },
]

function onThemeChange(val: ThemeMode) {
  setTheme(val)
}

// ── 退出登录 ──
const loggingOut = ref(false)

function handleLogout() {
  showConfirmDialog({
    title: '退出登录',
    message: '确定要退出登录吗？',
    confirmButtonText: '退出',
    cancelButtonText: '取消',
  })
    .then(async () => {
      loggingOut.value = true
      try {
        // 完整清理流程（与 PC 端 App.vue 一致）
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
        // MobileApp.vue 的 watch(userId) 会自动跳转到登录页
      } catch (e) {
        console.error('[mobile] logout error', e)
      } finally {
        loggingOut.value = false
      }
    })
    .catch(() => {
      // 用户取消
    })
}
</script>

<template>
  <div class="profile-page">
    <!-- 固定顶栏 -->
    <header class="m-header">
      <div class="m-header__safe-area" />
      <div class="m-header__bar">
        <span class="m-header__title">我的</span>
      </div>
    </header>

    <div class="profile-content">
      <!-- 用户资料卡 -->
      <div class="profile-card">
        <div class="profile-card__avatar">
          {{ nickname.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-card__info">
          <p class="profile-card__name">{{ nickname }}</p>
          <p class="profile-card__email">{{ email }}</p>
        </div>
      </div>

      <!-- 主题切换 -->
      <div class="profile-section">
        <p class="profile-section__title">主题</p>
        <div class="profile-themes">
          <div
            v-for="opt in themeOptions"
            :key="opt.value"
            class="profile-theme"
            :class="{ 'is-active': mode === opt.value }"
            @click="onThemeChange(opt.value)"
          >
            <div class="profile-theme__preview" :data-theme-name="opt.value">
              <span class="profile-theme__bar" />
              <span class="profile-theme__dot" />
            </div>
            <div class="profile-theme__label">
              <span class="profile-theme__name">{{ opt.label }}</span>
              <span class="profile-theme__desc">{{ opt.desc }}</span>
            </div>
            <span class="profile-theme__check" v-if="mode === opt.value">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <!-- 退出登录 -->
      <div class="profile-logout">
        <van-button
          block
          round
          type="danger"
          plain
          :loading="loggingOut"
          @click="handleLogout"
        >退出登录</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-1);
}

.profile-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 80px;
}

/* ── 用户卡片 ── */
.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 1px 3px var(--color-shadow);
  margin-bottom: 16px;
}

.profile-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-card__info {
  flex: 1;
  min-width: 0;
}

.profile-card__name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
}

.profile-card__email {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 分区 ── */
.profile-section {
  margin-bottom: 16px;
}

.profile-section__title {
  margin: 0 0 8px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-3);
}

/* ── 主题选择 ── */
.profile-themes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-theme {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
  cursor: pointer;
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
  border: 2px solid transparent;
}

.profile-theme:active {
  transform: scale(0.98);
}

.profile-theme.is-active {
  border-color: var(--color-primary);
}

.profile-theme__preview {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.profile-theme__preview[data-theme-name="tencent"] {
  background: #0052D9;
}
.profile-theme__preview[data-theme-name="zuru"] {
  background: #CB312D;
}
.profile-theme__preview[data-theme-name="dark"] {
  background: #1a1b20;
}

.profile-theme__bar {
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.7);
}

.profile-theme__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}

.profile-theme__label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-theme__name {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-1);
}

.profile-theme__desc {
  font-size: 12px;
  color: var(--color-text-3);
}

.profile-theme__check {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
  display: flex;
  align-items: center;
}

.profile-theme__check svg {
  width: 20px;
  height: 20px;
}

/* ── 退出按钮 ── */
.profile-logout {
  margin-top: 24px;
  padding: 0 4px;
}
</style>
