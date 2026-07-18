<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { showToast } from 'vant'
import logoUrl from '/icon-512.png'

defineOptions({ name: 'MobileLogin' })

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const loading = ref(false)

async function onSubmit() {
  if (!form.email || !form.password) {
    showToast('请输入邮箱和密码')
    return
  }
  loading.value = true
  try {
    const ok = await auth.signIn(form.email.trim(), form.password)
    if (ok) {
      router.replace({ name: 'm-home' })
    } else {
      showToast(auth.error || '登录失败')
    }
  } catch (e) {
    showToast('登录异常，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 顶部安全区 -->
    <div class="login-page__safe-area" />

    <!-- 品牌区 — 轻量 -->
    <div class="login-page__brand">
      <img class="login-page__logo" :src="logoUrl" alt="清记" />
      <p class="login-page__subtitle">清简记事，井然有序</p>
    </div>

    <!-- 表单区 -->
    <div class="login-page__form">
      <input
        v-model="form.email"
        type="email"
        class="login-input"
        placeholder="邮箱"
        autocomplete="email"
        inputmode="email"
      />

      <input
        v-model="form.password"
        type="password"
        class="login-input"
        placeholder="密码"
        autocomplete="current-password"
        @keyup.enter="onSubmit"
      />

      <button
        class="login-btn"
        :disabled="loading"
        @click="onSubmit"
      >
        <span v-if="loading" class="login-btn__spinner" />
        <span v-else>登录</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── 页面容器 ── */
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 32px;
  background: var(--color-bg-1);
}

.login-page__safe-area {
  height: var(--safe-top);
}

/* ── 品牌区 ── */
.login-page__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0 40px;
}

.login-page__logo {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 82, 217, 0.25);
  object-fit: cover;
  -webkit-user-drag: none;
  user-select: none;
}

.login-page__subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--color-text-3);
}

/* ── 表单区 ── */
.login-page__form {
  width: 100%;
  max-width: 320px;
}

.login-input {
  display: block;
  width: 100%;
  height: 56px;
  margin-bottom: 16px;
  padding: 0 18px;
  font-size: 16px;
  color: var(--color-text-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}

.login-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 82, 217, 0.08);
}

.login-input::placeholder {
  color: var(--color-text-3);
  font-size: 15px;
}

/* ── 按钮 ── */
.login-btn {
  width: 100%;
  height: 56px;
  margin-top: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.login-btn:active {
  opacity: 0.85;
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-btn__spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin 0.6s linear infinite;
  vertical-align: middle;
}

@keyframes login-spin {
  to { transform: rotate(360deg); }
}
</style>
