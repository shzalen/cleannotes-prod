<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Field as VanField, Button as VanButton, Toast } from 'vant'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value.trim() || !password.value.trim()) {
    Toast('请输入邮箱和密码')
    return
  }
  loading.value = true
  try {
    const ok = await auth.signIn(email.value.trim(), password.value)
    if (ok) {
      router.push({ name: 'home' })
    } else {
      Toast(auth.error || '登录失败')
    }
  } catch {
    Toast('登录失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page safe-top">
    <div class="login-container">
      <div class="brand">
        <div class="brand-icon">清</div>
        <h1 class="brand-name">清记</h1>
        <p class="brand-desc">CleanNotes</p>
      </div>

      <div class="login-form">
        <VanField
          v-model="email"
          type="email"
          label=""
          placeholder="邮箱"
          left-icon="envelop-o"
          :disabled="loading"
          clearable
          class="login-field"
        />
        <VanField
          v-model="password"
          type="password"
          label=""
          placeholder="密码"
          left-icon="lock"
          :disabled="loading"
          class="login-field"
        />

        <VanButton
          type="primary"
          block
 round
          :loading="loading"
          :loading-text="'登录中...'"
          class="login-btn"
          @click="handleLogin"
        >
          登录
        </VanButton>
      </div>
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
  background: var(--color-bg-0, #fff);
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
  background: var(--color-primary, #0052D9);
  color: #fff;
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
  color: var(--color-text-1, #0F172A);
}

.brand-desc {
  font-size: 13px;
  color: var(--color-text-3, #64748B);
  margin-top: 4px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-field {
  border: 1px solid var(--color-border, #DCDEE0);
  border-radius: 12px;
  overflow: hidden;
}

.login-btn {
  margin-top: 8px;
  height: 48px;
  font-size: 17px;
  font-weight: 600;
}
</style>
