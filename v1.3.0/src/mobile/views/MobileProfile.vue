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
import MobileSubApp from '../components/MobileSubApp.vue'
import MobileTodoApp from '../components/MobileTodoApp.vue'
import MobileMemoApp from '../components/MobileMemoApp.vue'
import MobileWeeklyApp from '../components/MobileWeeklyApp.vue'

defineOptions({ name: 'MobileProfile' })

const auth = useAuthStore()
const { mode, setTheme } = useTheme()

const nickname = computed(() => auth.user?.nickname || '用户')
const email = computed(() => auth.user?.email || '')

// ── 主题下拉选项 ──
const themeOptions = [
  { text: '腾讯蓝', value: 'tencent' as ThemeMode },
  { text: 'ZURU', value: 'zuru' as ThemeMode },
  { text: '暗黑', value: 'dark' as ThemeMode },
]

function onThemeChange(val: ThemeMode) {
  setTheme(val)
}

// ── 修改昵称 ──
const showNicknameEdit = ref(false)
const newNickname = ref('')

function openNicknameEdit() {
  newNickname.value = auth.user?.nickname || ''
  showNicknameEdit.value = true
}

async function saveNickname() {
  const n = newNickname.value.trim()
  if (!n) {
    showToast('昵称不能为空')
    return
  }
  const ok = await auth.changeNickname(n)
  if (ok) {
    showToast('昵称已修改')
    showNicknameEdit.value = false
  } else {
    showToast(auth.error || '修改失败')
  }
}

// ── 修改密码 ──
const showPasswordEdit = ref(false)
const pwNew = ref('')
const pwConfirm = ref('')
const pwSaving = ref(false)
const pwError = ref('')

function openPasswordEdit() {
  pwNew.value = ''
  pwConfirm.value = ''
  pwError.value = ''
  showPasswordEdit.value = true
}

async function savePassword() {
  pwError.value = ''
  if (pwNew.value.length < 8) {
    pwError.value = '密码至少 8 位'
    return
  }
  if (pwNew.value !== pwConfirm.value) {
    pwError.value = '两次密码不一致'
    return
  }
  pwSaving.value = true
  try {
    const ok = await auth.changePassword(pwNew.value)
    if (ok) {
      showToast('密码已修改')
      showPasswordEdit.value = false
    } else {
      pwError.value = auth.error || '修改失败'
    }
  } finally {
    pwSaving.value = false
  }
}

// ── 清空页面缓存（保留登录态） ──
async function handleClearCache() {
  await showConfirmDialog({
    title: '清空页面缓存',
    message: '清除浏览器缓存以加载最新版本，登录状态不受影响。',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })

  try {
    // 1. 清除 Service Worker 缓存（缓存旧版 JS/CSS 的主因）
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(n => caches.delete(n)))
    }

    // 2. 注销旧 Service Worker，下次加载后自动注册新版本
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }

    // 3. 清除应用层缓存标记（同步时间戳、growth flags 等）
    clearAllLastSyncAt()
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('cleannotes_') && k !== 'cleannotes_theme'
    )
    keys.forEach(k => localStorage.removeItem(k))

    showToast('缓存已清空，正在刷新…')

    // 延迟让提示可见后硬刷新（跳过 HTTP 缓存）
    setTimeout(() => {
      window.location.reload()
    }, 800)
  } catch {
    showToast('清理失败，请手动清除浏览器缓存')
  }
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
      } catch (e) {
        console.error('[mobile] logout error', e)
      } finally {
        loggingOut.value = false
      }
    })
    .catch(() => {})
}

// ── 子应用 ──
const subApp = ref<InstanceType<typeof MobileSubApp> | null>(null)

function openTodoApp() {
  subApp.value?.open('待办事项', MobileTodoApp)
}

function openMemoApp() {
  subApp.value?.open('备忘录', MobileMemoApp)
}

function openWeeklyApp() {
  subApp.value?.open('周报', MobileWeeklyApp)
}

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

const appVersion = __APP_VERSION__
const buildTime = __BUILD_TIME__
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
      <div class="profile-card" @click="openNicknameEdit">
        <div class="profile-card__avatar">
          {{ nickname.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-card__info">
          <div class="profile-card__name-row">
            <p class="profile-card__name">{{ nickname }}</p>
            <span class="profile-card__edit-hint">点击修改</span>
          </div>
          <p class="profile-card__email">{{ email }}</p>
        </div>
      </div>

      <!-- 设置项列表 -->
      <div class="profile-menu">
        <!-- 主题 -->
        <div class="profile-menu__item">
          <span class="profile-menu__label">主题</span>
          <div class="profile-menu__right">
            <select
              class="profile-menu__select"
              :value="mode"
              @change="onThemeChange(($event.target as HTMLSelectElement).value as ThemeMode)"
            >
              <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
                {{ opt.text }}
              </option>
            </select>
            <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <!-- 修改昵称 -->
        <div class="profile-menu__item" @click="openNicknameEdit">
          <span class="profile-menu__label">修改昵称</span>
          <div class="profile-menu__right">
            <span class="profile-menu__value">{{ nickname }}</span>
            <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </div>

        <!-- 修改密码 -->
        <div class="profile-menu__item" @click="openPasswordEdit">
          <span class="profile-menu__label">修改密码</span>
          <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>

        <!-- 清空缓存 -->
        <div class="profile-menu__item" @click="handleClearCache">
          <span class="profile-menu__label">清空缓存</span>
          <span class="profile-menu__hint">更新后看不到效果时使用</span>
        </div>
      </div>

      <!-- 子应用入口 -->
      <div class="profile-section">
        <p class="profile-section__title">功能</p>
        <div class="profile-menu">
          <div class="profile-menu__item" @click="openTodoApp">
            <div class="profile-menu__left">
              <svg class="profile-menu__icon profile-menu__icon--todo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="20" height="18" rx="3" fill="#5B8FF9" opacity="0.18"/>
                <rect x="5" y="7" width="4" height="4" rx="1" fill="#5B8FF9"/>
                <rect x="11" y="8" width="8" height="2" rx="1" fill="#5B8FF9" opacity="0.7"/>
                <rect x="5" y="13" width="4" height="4" rx="1" fill="#5B8FF9"/>
                <rect x="11" y="14" width="8" height="2" rx="1" fill="#5B8FF9" opacity="0.7"/>
                <path d="M6.5 9L7.5 10 9.5 7.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 15L7.5 16 9.5 13.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="profile-menu__label">待办事项</span>
            </div>
            <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
          <div class="profile-menu__item" @click="openMemoApp">
            <div class="profile-menu__left">
              <svg class="profile-menu__icon profile-menu__icon--memo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5a2 2 0 012-2h10l4 4v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" fill="#FAAD14" opacity="0.18"/>
                <path d="M4 5a2 2 0 012-2h10l4 4v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" stroke="#FAAD14" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M14 3v4h4" stroke="#FAAD14" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="7" y="10" width="10" height="1.5" rx="0.75" fill="#FAAD14" opacity="0.7"/>
                <rect x="7" y="14" width="7" height="1.5" rx="0.75" fill="#FAAD14" opacity="0.5"/>
              </svg>
              <span class="profile-menu__label">备忘录</span>
            </div>
            <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
          <div class="profile-menu__item" @click="openWeeklyApp">
            <div class="profile-menu__left">
              <svg class="profile-menu__icon profile-menu__icon--weekly" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="20" height="18" rx="3" fill="#52C41A" opacity="0.18"/>
                <rect x="5" y="14" width="3" height="5" rx="1" fill="#52C41A"/>
                <rect x="10.5" y="10" width="3" height="9" rx="1" fill="#52C41A" opacity="0.85"/>
                <rect x="16" y="6" width="3" height="13" rx="1" fill="#52C41A" opacity="0.6"/>
                <path d="M4 18.5h16" stroke="#52C41A" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span class="profile-menu__label">周报</span>
            </div>
            <svg class="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
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

      <!-- 版本信息 -->
      <div class="profile-version">
        v{{ appVersion }} · {{ buildTime }}
      </div>
    </div>

    <!-- 修改昵称弹窗 -->
    <van-popup
      v-model:show="showNicknameEdit"
      position="bottom"
      round
      teleport="body"
      :style="{ '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="edit-sheet">
        <div class="edit-sheet__header">
          <span class="edit-sheet__title">修改昵称</span>
          <button class="edit-sheet__close" @click="showNicknameEdit = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="edit-sheet__body">
          <van-cell-group inset>
            <van-field
              v-model="newNickname"
              label="昵称"
              placeholder="输入新昵称"
              clearable
              autofocus
            />
          </van-cell-group>
        </div>
        <div class="edit-sheet__footer">
          <van-button block round type="primary" @click="saveNickname">保存</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 修改密码弹窗 -->
    <van-popup
      v-model:show="showPasswordEdit"
      position="bottom"
      round
      teleport="body"
      :style="{ '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="edit-sheet">
        <div class="edit-sheet__header">
          <span class="edit-sheet__title">修改密码</span>
          <button class="edit-sheet__close" @click="showPasswordEdit = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="edit-sheet__body">
          <van-cell-group inset>
            <van-field
              v-model="pwNew"
              label="新密码"
              placeholder="至少 8 位"
              type="password"
              clearable
            />
            <van-field
              v-model="pwConfirm"
              label="确认密码"
              placeholder="再次输入密码"
              type="password"
              clearable
            />
          </van-cell-group>
          <p v-if="pwError" class="edit-sheet__error">{{ pwError }}</p>
        </div>
        <div class="edit-sheet__footer">
          <van-button block round type="primary" :loading="pwSaving" @click="savePassword">保存</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 全屏子应用容器 -->
    <MobileSubApp ref="subApp" />
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden; /* 禁止滚动穿透 */
  background: var(--color-bg-1);
}

.profile-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y; /* 确保垂直滑动手势正确传递 */
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
  cursor: pointer;
}
.profile-card:active { transform: scale(0.98); }

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

.profile-card__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.profile-card__edit-hint {
  font-size: 14px;
  color: var(--color-primary);
}

.profile-card__email {
  margin: 4px 0 0;
  font-size: 15px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 设置菜单 ── */
.profile-menu {
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 1px 3px var(--color-shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

.profile-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 16px 16px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid var(--color-border-light);
  box-sizing: border-box;
}
.profile-menu__item:last-child { border-bottom: none; }
.profile-menu__item:active { background: var(--color-bg-3); }

.profile-menu__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.profile-menu__icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
}

.profile-menu__label {
  font-size: 16px;
  font-weight: 400;
  color: var(--color-text-1);
}

.profile-menu__right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.profile-menu__value {
  font-size: 15px;
  color: var(--color-text-3);
}

.profile-menu__hint {
  font-size: 13px;
  color: var(--color-text-4);
}

.profile-menu__select {
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--color-text-2);
  outline: none;
  cursor: pointer;
  padding: 2px 4px;
  -webkit-appearance: none;
  appearance: none;
  text-align: right;
  direction: rtl;
}

.profile-menu__chevron {
  width: 16px;
  height: 16px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

/* ── 分区 ── */
.profile-section {
  margin-bottom: 16px;
}

.profile-section__title {
  margin: 0 0 8px;
  padding: 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-3);
}

/* ── 退出按钮 ── */
.profile-logout {
  margin-top: 24px;
  padding: 0 4px;
}

/* ── 版本信息 ── */
.profile-version {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-4);
  opacity: 0.5;
  padding: 16px 0 8px;
}

/* ── 编辑弹窗 ── */
.edit-sheet {
  background: var(--color-surface);
  padding-bottom: var(--safe-bottom);
}

.edit-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.edit-sheet__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.edit-sheet__close {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  padding: 4px;
  cursor: pointer;
}
.edit-sheet__close svg { width: 20px; height: 20px; }

.edit-sheet__body {
  padding: 12px 0 4px;
  overflow-x: hidden;
  touch-action: pan-y;
  max-width: 100%;
}

.edit-sheet__error {
  padding: 8px 16px 0;
  margin: 0;
  font-size: 17px;
  color: var(--color-danger);
}

.edit-sheet__footer {
  padding: 12px 16px 16px;
}
</style>
