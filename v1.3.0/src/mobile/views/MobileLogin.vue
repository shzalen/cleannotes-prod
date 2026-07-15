<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { showToast } from 'vant'

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
    <div class="login-page__safe-area" />

    <!-- 品牌区 -->
    <div class="login-page__brand">
      <div class="login-page__logo">清</div>
      <h1 class="login-page__title">清记</h1>
    </div>

    <!-- 表单区 -->
    <div class="login-page__form">
      <div class="login-field">
        <label class="login-field__label">邮箱</label>
        <input
          v-model="form.email"
          type="email"
          class="login-field__input"
          placeholder="请输入邮箱"
          autocomplete="email"
          inputmode="email"
        />
      </div>

      <div class="login-field">
        <label class="login-field__label">密码</label>
        <input
          v-model="form.password"
          type="password"
          class="login-field__input"
          placeholder="请输入密码"
          autocomplete="current-password"
          @keyup.enter="onSubmit"
        />
      </div>

      <button
        class="login-submit"
        :disabled="loading"
        @click="onSubmit"
      >
        <span v-if="loading" class="login-submit__spinner" />
        <span v-else>登 录</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── 页面容器 ── */
.login-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-bg-1);
}

.login-page__safe-area {
  height: var(--safe-top);
  background: var(--color-primary);
}

/* ── 品牌区 ── */
.login-page__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 48px;
  background: var(--color-primary);
  border-radius: 0 0 20px 20px;
}

.login-page__logo {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 20px;
}

.login-page__title {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 6px;
}

/* ── 表单区 ── */
.login-page__form {
  padding: 40px 24px 0;
  flex: 1;
}

.login-field {
  margin-bottom: 24px;
}

.login-field__label {
  display: block;
  font-size: 17px;
  font-weight: 500;
  color: var(--color-text-2);
  margin-bottom: 10px;
  padding-left: 4px;
}

.login-field__input {
  width: 100%;
  height: 56px;
  padding: 0 18px;
  font-size: 18px;
  color: var(--color-text-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}

.login-field__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 82, 217, 0.1);
}

.login-field__input::placeholder {
  color: var(--color-text-3);
  font-size: 17px;
}

/* ── 登录按钮 ── */
.login-submit {
  width: 100%;
  height: 56px;
  margin-top: 12px;
  background: var(--color-primary);
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: opacity 0.2s;
  letter-spacing: 4px;
}

.login-submit:active {
  opacity: 0.85;
}

.login-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── 加载旋转器 ── */
.login-submit__spinner {
  display: inline-block;
  width: 22px;
  height: 22px;
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
