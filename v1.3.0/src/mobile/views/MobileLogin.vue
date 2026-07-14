<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMsg.value = '请输入邮箱和密码'
    return
  }
  errorMsg.value = ''
  loading.value = true
  const ok = await auth.signIn(email.value, password.value)
  loading.value = false
  if (ok) {
    router.push({ name: 'home' })
  } else {
    errorMsg.value = auth.error || '登录失败'
  }
}
</script>

<template>
  <div class="login-page safe-top safe-bottom">
    <div class="login-header">
      <div class="logo-circle">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" stroke="white" stroke-width="2"/>
          <path d="M8 10H16M8 14H13" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="login-title">清记</h1>
      <p class="login-subtitle">记录每一天的成长</p>
    </div>

    <form class="login-form" @submit.prevent="handleLogin">
      <div class="input-group">
        <input
          v-model="email"
          type="email"
          placeholder="邮箱"
          class="input-field"
          autocomplete="email"
        />
      </div>
      <div class="input-group">
        <input
          v-model="password"
          type="password"
          placeholder="密码"
          class="input-field"
          autocomplete="current-password"
        />
      </div>

      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

      <button type="submit" class="login-btn" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32px;
  background: var(--color-bg-1);
}

.login-header {
  text-align: center;
  margin-bottom: 48px;
}

.logo-circle {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.login-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
}

.login-subtitle {
  font-size: 14px;
  color: var(--color-text-3);
  margin: 8px 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  position: relative;
}

.input-field {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font-size: 16px;
  color: var(--color-text-1);
  background: var(--color-surface);
  outline: none;
  transition: border-color 0.2s;
}

.input-field:focus {
  border-color: var(--color-primary);
}

.error-text {
  font-size: 13px;
  color: var(--color-danger);
  margin: 0;
  text-align: center;
}

.login-btn {
  height: 48px;
  border: none;
  border-radius: 12px;
  background: var(--color-primary);
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}

.login-btn:active {
  opacity: 0.8;
}

.login-btn:disabled {
  opacity: 0.5;
}
</style>
