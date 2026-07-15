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
    <div class="login-page__hero">
      <div class="login-page__safe-area" />
      <div class="login-page__brand">
        <div class="login-page__logo">清</div>
        <h1 class="login-page__title">清记</h1>
        <p class="login-page__subtitle">简洁高效的待办管理</p>
      </div>
    </div>

    <div class="login-page__form">
      <van-cell-group inset>
        <van-field
          v-model="form.email"
          label="邮箱"
          placeholder="请输入邮箱"
          type="email"
          clearable
        />
        <van-field
          v-model="form.password"
          label="密码"
          placeholder="请输入密码"
          type="password"
          clearable
          @keyup.enter="onSubmit"
        />
      </van-cell-group>

      <div class="login-page__actions">
        <van-button
          type="primary"
          block
          round
          :loading="loading"
          @click="onSubmit"
        >
          登录
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-bg-1);
}

.login-page__hero {
  background: var(--color-primary);
  padding-bottom: 32px;
  border-radius: 0 0 24px 24px;
}

.login-page__safe-area {
  height: var(--safe-top);
}

.login-page__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.login-page__logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 14px;
  backdrop-filter: blur(8px);
}

.login-page__title {
  margin: 0;
  font-size: 29px;
  font-weight: 700;
  color: #fff;
}

.login-page__subtitle {
  margin: 4px 0 0;
  font-size: 17px;
  color: rgba(255, 255, 255, 0.8);
}

.login-page__form {
  padding: 24px 0;
  flex: 1;
}

.login-page__actions {
  padding: 20px 16px 0;
}
</style>
