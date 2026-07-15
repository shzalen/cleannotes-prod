<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { CellGroup as VanCellGroup, Cell as VanCell, Dialog as VanDialog, Field as VanField, Button as VanButton, Toast } from 'vant'

const auth = useAuthStore()
const handleLogout = inject<() => Promise<void>>('appLogout')

const nickname = computed(() => auth.user?.nickname || '用户')
const email = computed(() => auth.user?.email || '')
const initial = computed(() => nickname.value.charAt(0).toUpperCase())

// ── 修改密码 ──
const showPwdDialog = ref(false)
const newPwd = ref('')
const pwdLoading = ref(false)

async function handleChangePwd() {
  if (newPwd.value.length < 8) { Toast('密码长度至少 8 位'); return }
  pwdLoading.value = true
  try {
    const ok = await auth.changePassword(newPwd.value)
    if (ok) {
      Toast.success('密码修改成功')
      showPwdDialog.value = false
      newPwd.value = ''
    } else {
      Toast(auth.error || '修改失败')
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
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    const preserveKeys = ['cleannotes_theme']
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cleannotes') && !preserveKeys.includes(key)) keysToRemove.push(key)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } finally {
    clearingCache.value = false
    window.location.reload()
  }
}

// ── 退出确认 ──
const showLogoutDialog = ref(false)
async function confirmLogout() {
  showLogoutDialog.value = false
  if (handleLogout) { await handleLogout() }
  else { auth.logout(); window.location.reload() }
}

const version = '1.3.0'
</script>

<template>
  <div class="profile-page safe-top">
    <!-- 页面标题 -->
    <div class="profile-header">
      <h1 class="profile-title">我的</h1>
    </div>

    <!-- 用户信息 -->
    <div class="user-section">
      <div class="user-card">
        <div class="avatar">{{ initial }}</div>
        <div class="user-info">
          <span class="user-name">{{ nickname }}</span>
          <span class="user-email">{{ email }}</span>
        </div>
      </div>
    </div>

    <!-- 设置 -->
    <VanCellGroup inset class="cell-group">
      <VanCell title="修改密码" is-link @click="showPwdDialog = true" />
    </VanCellGroup>

    <VanCellGroup inset class="cell-group">
      <VanCell :title="clearingCache ? '清除中...' : '清除缓存'" is-link @click="handleClearCache" />
      <VanCell title="版本">
        <template #value>
          <span class="version-text">V{{ version }}</span>
        </template>
      </VanCell>
    </VanCellGroup>

    <VanCellGroup inset class="cell-group">
      <VanCell title="退出登录" class="logout-cell" @click="showLogoutDialog = true" />
    </VanCellGroup>

    <!-- 修改密码弹窗 -->
    <VanDialog
      v-model:show="showPwdDialog"
      title="修改密码"
      show-cancel-button
      :confirm-button-loading="pwdLoading"
      @confirm="handleChangePwd"
    >
      <VanField
        v-model="newPwd"
        type="password"
        placeholder="输入新密码（至少 8 位）"
        class="dialog-field"
      />
    </VanDialog>

    <!-- 退出确认弹窗 -->
    <VanDialog
      v-model:show="showLogoutDialog"
      title="退出登录"
      message="确定要退出当前账号吗？"
      show-cancel-button
      confirm-button-color="var(--color-danger)"
      @confirm="confirmLogout"
    />
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100%;
  background: var(--color-bg-1, #F3F3F4);
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}

.profile-header {
  padding: 16px 20px 8px;
}

.profile-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-1);
  letter-spacing: -0.3px;
}

.user-section {
  padding: 12px 16px 20px;
}

.user-card {
  display: flex; align-items: center; gap: 16px;
  padding: 22px 18px;
  background: var(--color-surface, #fff);
  border-radius: 16px;
}

.avatar {
  width: 60px; height: 60px; border-radius: 50%;
  background: var(--color-primary, #0052D9);
  color: #fff; font-size: 24px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.user-info { display: flex; flex-direction: column; gap: 4px; }

.user-name { font-size: 20px; font-weight: 600; color: var(--color-text-1); }
.user-email { font-size: 14px; color: var(--color-text-3); }

.cell-group { margin: 12px 16px; }

.cell-group :deep(.van-cell) {
  padding: 18px 16px;
  font-size: 17px;
}

.cell-group :deep(.van-cell__title) {
  font-weight: 500;
}

.version-text { color: var(--color-text-3); font-size: 15px; }

.logout-cell {
  text-align: center;
}

:deep(.logout-cell .van-cell__title) {
  text-align: center;
  color: var(--color-danger);
  font-size: 17px;
  font-weight: 500;
}

.dialog-field {
  margin: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
</style>
