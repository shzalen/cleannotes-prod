<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const handleLogout = inject<() => Promise<void>>('appLogout')

// ── 用户信息 ──
const nickname = computed(() => auth.user?.nickname || '用户')
const email = computed(() => auth.user?.email || '')
const initial = computed(() => nickname.value.charAt(0).toUpperCase())

// ── 修改密码 ──
const showPwdSheet = ref(false)
const newPwd = ref('')
const pwdError = ref('')
const pwdLoading = ref(false)
const pwdSuccess = ref(false)

async function handleChangePwd() {
  pwdError.value = ''
  if (newPwd.value.length < 8) {
    pwdError.value = '密码长度至少 8 位'
    return
  }
  pwdLoading.value = true
  try {
    const ok = await auth.changePassword(newPwd.value)
    if (ok) {
      pwdSuccess.value = true
      setTimeout(() => { showPwdSheet.value = false; pwdSuccess.value = false; newPwd.value = '' }, 1500)
    } else {
      pwdError.value = auth.error || '修改失败'
    }
  } finally {
    pwdLoading.value = false
  }
}

// ── 清除缓存 ──
const clearingCache = ref(false)
async function handleClearCache() {
  clearingCache.value = true
  try {
    // Clear Service Worker caches
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    // Unregister SW
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    // Clear localStorage app data (keep theme setting)
    const preserveKeys = ['cleannotes_theme']
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cleannotes') && !preserveKeys.includes(key)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } finally {
    clearingCache.value = false
    window.location.reload()
  }
}

// ── 退出确认 ──
const showLogoutConfirm = ref(false)
async function confirmLogout() {
  showLogoutConfirm.value = false
  if (handleLogout) {
    await handleLogout()
  } else {
    auth.logout()
    window.location.reload()
  }
}

// ── 版本 ──
const version = '1.3.0'
</script>

<template>
  <div class="profile-page">
    <!-- Header -->
    <div class="profile-header safe-top">
      <h1 class="profile-title">我的</h1>
    </div>

    <!-- User Card -->
    <div class="section">
      <div class="user-card">
        <div class="avatar">{{ initial }}</div>
        <div class="user-info">
          <span class="user-name">{{ nickname }}</span>
          <span class="user-email">{{ email }}</span>
        </div>
      </div>
    </div>

    <!-- Settings Group -->
    <div class="section">
      <button class="row-btn" @click="showPwdSheet = true">
        <span>修改密码</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18L15 12L9 6"/></svg>
      </button>
    </div>

    <!-- Actions Group -->
    <div class="section">
      <button class="row-btn" :disabled="clearingCache" @click="handleClearCache">
        <span>{{ clearingCache ? '清除中...' : '清除缓存' }}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18L15 12L9 6"/></svg>
      </button>
      <div class="row-text">
        <span>版本</span>
        <span class="row-value">V{{ version }}</span>
      </div>
    </div>

    <!-- Logout -->
    <div class="section">
      <button class="row-btn logout-btn" @click="showLogoutConfirm = true">
        退出登录
      </button>
    </div>

    <!-- ── 修改密码弹窗 ── -->
    <teleport to="body">
      <div v-if="showPwdSheet" class="sheet-overlay" @click.self="showPwdSheet = false">
        <div class="sheet-panel">
          <div class="sheet-handle" />
          <div class="sheet-content">
            <h3 class="sheet-title">修改密码</h3>
            <input
              v-model="newPwd"
              type="password"
              class="sheet-input"
              placeholder="输入新密码（至少 8 位）"
              :disabled="pwdLoading || pwdSuccess"
            />
            <p v-if="pwdError" class="sheet-error">{{ pwdError }}</p>
            <p v-if="pwdSuccess" class="sheet-success">密码修改成功！</p>
            <div class="sheet-actions">
              <button class="sheet-btn cancel" @click="showPwdSheet = false">取消</button>
              <button class="sheet-btn confirm" :disabled="pwdLoading || pwdSuccess" @click="handleChangePwd">
                {{ pwdLoading ? '修改中...' : '确认修改' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ── 退出确认弹窗 ── -->
    <teleport to="body">
      <div v-if="showLogoutConfirm" class="sheet-overlay" @click.self="showLogoutConfirm = false">
        <div class="sheet-panel">
          <div class="sheet-handle" />
          <div class="sheet-content">
            <h3 class="sheet-title">退出登录</h3>
            <p class="sheet-desc">确定要退出当前账号吗？</p>
            <div class="sheet-actions">
              <button class="sheet-btn cancel" @click="showLogoutConfirm = false">取消</button>
              <button class="sheet-btn danger" @click="confirmLogout">退出</button>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100%;
  background: var(--color-bg-1);
}

.profile-header {
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-separator);
  padding: 12px 16px;
}

.profile-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text-1);
}

/* ── Sections ── */
.section {
  background: var(--color-surface);
  margin: 16px;
  border-radius: 12px;
  overflow: hidden;
}

/* ── User Card ── */
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 16px;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
}

.user-email {
  font-size: 13px;
  color: var(--color-text-3);
}

/* ── Row Button ── */
.row-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: none;
  background: none;
  font-size: 15px;
  color: var(--color-text-1);
  cursor: pointer;
  border-bottom: 0.5px solid var(--color-separator);
}

.row-btn:last-child {
  border-bottom: none;
}

.row-btn:active {
  background: var(--color-bg-2);
}

.row-btn svg {
  color: var(--color-text-4);
}

.logout-btn {
  color: var(--color-danger);
  justify-content: center;
}

.row-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 15px;
  color: var(--color-text-1);
}

.row-value {
  color: var(--color-text-3);
  font-size: 14px;
}

/* ── Sheet Content ── */
.sheet-content {
  padding: 8px 20px 24px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 16px;
  text-align: center;
}

.sheet-desc {
  font-size: 14px;
  color: var(--color-text-2);
  text-align: center;
  margin-bottom: 20px;
}

.sheet-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 15px;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  outline: none;
}

.sheet-input:focus {
  border-color: var(--color-primary);
}

.sheet-error {
  font-size: 13px;
  color: var(--color-danger);
  margin-top: 8px;
}

.sheet-success {
  font-size: 13px;
  color: var(--color-primary);
  margin-top: 8px;
}

.sheet-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.sheet-btn {
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.sheet-btn:active {
  opacity: 0.7;
}

.sheet-btn.cancel {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.sheet-btn.confirm {
  background: var(--color-primary);
  color: #fff;
}

.sheet-btn.danger {
  background: var(--color-danger);
  color: #fff;
}

.sheet-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
