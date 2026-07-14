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
const showPassword = ref(false)

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
    errorMsg.value = auth.error || '登录失败，请检查邮箱和密码'
  }
}
</script>

<template>
  <div class="login-page safe-top safe-bottom">
    <!-- Brand area -->
    <div class="login-brand">
      <div class="logo-wrapper">
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <rect x="4" y="4" width="40" height="40" rx="12" fill="var(--color-primary)"/>
          <path d="M14 18H34M14 26H28" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <path d="M14 18L20 30L34 18" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 class="login-title">清记</h1>
      <p class="login-subtitle">简洁 · 高效 · 记录每一天</p>
    </div>

    <!-- Form -->
    <div class="login-form-area">
      <!-- Email -->
      <div class="input-wrapper">
        <svg class="input-icon" viewBox="0 0 24 24" width="20" height="20" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="var(--color-text-4)" stroke-width="1.8"/>
          <path d="M2 7L12 13L22 7" stroke="var(--color-text-4)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <input
          v-model="email"
          type="email"
          placeholder="请输入邮箱"
          class="input-field"
          autocomplete="email"
        />
      </div>

      <!-- Password -->
      <div class="input-wrapper">
        <svg class="input-icon" viewBox="0 0 24 24" width="20" height="20" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--color-text-4)" stroke-width="1.8"/>
          <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="var(--color-text-4)" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1.5" fill="var(--color-text-4)"/>
        </svg>
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="请输入密码"
          class="input-field"
          autocomplete="current-password"
        />
        <button type="button" class="toggle-pw" @click="showPassword = !showPassword">
          <svg v-if="showPassword" viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12C22 12 18 19 12 19C6 19 2 12 2 12Z" stroke="var(--color-text-4)" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="3" stroke="var(--color-text-4)" stroke-width="1.8"/>
            <line x1="2" y1="2" x2="22" y2="22" stroke="var(--color-text-4)" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12C22 12 18 19 12 19C6 19 2 12 2 12Z" stroke="var(--color-text-4)" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="3" fill="var(--color-text-4)"/>
          </svg>
        </button>
      </div>

      <!-- Error -->
      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

      <!-- Submit -->
      <button
        type="submit"
        class="login-btn"
        :class="{ loading: loading }"
        :disabled="loading"
        @click="handleLogin"
      >
        <span v-if="loading" class="btn-spinner" />
        <span>{{ loading ? '登录中...' : '登录' }}</span>
      </button>
    </div>

    <!-- Footer -->
    <p class="login-footer">
      登录即表示同意
      <a href="#" class="footer-link">服务协议</a>
      和
      <a href="#" class="footer-link">隐私政策</a>
    </p>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 28px;
  background: var(--color-bg-0);
}

/* ===== Brand ===== */
.login-brand {
  text-align: center;
  margin-bottom: 44px;
}

.logo-wrapper {
  display: inline-block;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 12px rgba(79, 108, 247, 0.25));
}

.login-title {
  font-size: 34px;
  font-weight: 800;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -1px;
}

.login-subtitle {
  font-size: 15px;
  color: var(--color-text-3);
  margin: 8px 0 0;
  font-weight: 400;
  letter-spacing: 1px;
}

/* ===== Form ===== */
.login-form-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  z-index: 1;
  pointer-events: none;
}

.input-field {
  width: 100%;
  height: 54px;
  padding: 0 48px 0 48px;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  font-size: 16px;
  color: var(--color-text-1);
  background: var(--color-bg-2);
  outline: none;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.input-field:focus {
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.input-field::placeholder {
  color: var(--color-text-4);
}

.toggle-pw {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-text {
  font-size: 14px;
  color: var(--color-danger);
  margin: 2px 0 0;
  text-align: center;
  padding: 4px 0;
}

/* ===== Button ===== */
.login-btn {
  height: 52px;
  border: none;
  border-radius: 14px;
  background: var(--color-primary);
  color: white;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s, opacity 0.2s;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-btn.loading {
  background: var(--color-primary-hover);
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Footer ===== */
.login-footer {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-4);
  margin-top: 36px;
  line-height: 1.6;
}

.footer-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}
</style>
