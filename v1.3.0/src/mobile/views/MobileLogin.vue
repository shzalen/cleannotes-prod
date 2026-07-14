<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

async function handleLogin() {
  error.value = ''
  if (!email.value.trim() || !password.value.trim()) {
    error.value = '请输入邮箱和密码'
    return
  }
  loading.value = true
  try {
    const ok = await auth.signIn(email.value.trim(), password.value)
    if (ok) {
      router.push({ name: 'home' })
    } else {
      error.value = auth.error || '登录失败，请检查邮箱和密码'
    }
  } catch (e) {
    error.value = '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Brand -->
      <div class="brand">
        <div class="brand-icon">清</div>
        <h1 class="brand-name">清记</h1>
        <p class="brand-desc">CleanNotes</p>
      </div>

      <!-- Form -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 7L12 13L22 7" />
          </svg>
          <input
            v-model="email"
            type="email"
            class="input"
            placeholder="邮箱"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="input"
            placeholder="密码"
            autocomplete="current-password"
            :disabled="loading"
          />
          <button type="button" class="toggle-pw" @click="showPassword = !showPassword">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <template v-if="showPassword">
                <path d="M1 12S4.5 4 12 4S23 12 23 12S19.5 20 12 20S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3" />
              </template>
              <template v-else>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20C4.5 20 1 12 1 12S4.5 4 12 4A10.07 10.07 0 0117.94 6.06" />
                <path d="M9.9 9.9A3 3 0 0114.1 14.1" />
                <path d="M1 1L23 23" />
              </template>
            </svg>
          </button>
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn-login" :disabled="loading">
          <template v-if="loading">
            <span class="spinner" />
            登录中...
          </template>
          <template v-else>登录</template>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
  background: var(--color-bg-0);
}

.login-container {
  width: 100%;
  max-width: 360px;
}

.brand {
  text-align: center;
  margin-bottom: 40px;
}

.brand-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 32px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 24px rgba(0, 82, 217, 0.25);
}

.brand-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
}

.brand-desc {
  font-size: 13px;
  color: var(--color-text-3);
  margin-top: 4px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 20px;
  height: 20px;
  color: var(--color-text-4);
  pointer-events: none;
}

.input {
  width: 100%;
  height: 48px;
  padding: 0 44px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-1);
  font-size: 16px;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--color-primary);
}

.input::placeholder {
  color: var(--color-text-4);
}

.toggle-pw {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-4);
  padding: 4px;
  display: flex;
}

.error-msg {
  font-size: 13px;
  color: var(--color-danger);
  text-align: center;
  padding: 4px 0;
}

.btn-login {
  height: 48px;
  border: none;
  border-radius: 12px;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s;
  margin-top: 4px;
}

.btn-login:active {
  opacity: 0.8;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
