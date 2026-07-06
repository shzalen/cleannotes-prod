<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGrowthStore } from '@/stores/growth'
import { switchUser } from '@/services/storage'
import { mergeFromCloud } from '@/services/hybrid'
import { useTaskStore } from '@/stores/task'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { useRouter } from 'vue-router'
import { isMobileDevice } from '@/utils/device'

const auth = useAuthStore()
const taskStore = useTaskStore()
const growthStore = useGrowthStore()
const router = useRouter()

const phone = ref('')
const code = ref('')
const step = ref<'phone' | 'verify'>('phone')

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))
const codeValid = computed(() => /^\d{6}$/.test(code.value))

// ---- Clock widget ----
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null

const currentTime = computed(() => {
  return now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
})

const currentDate = computed(() => {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = now.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

onMounted(() => {
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

/** 处理登录/注册成功后的数据加载和跳转 */
async function onLoginSuccess() {
  switchUser(auth.userId)
  // ① 立即加载本地数据到 store（同步，极快）
  taskStore.load()
  growthStore.load()
  // ② 注册成长系统回调
  useGrowthIntegration()
  // ③ 等待响应式更新完成，再跳转（避免 beforeEach 守卫中 isAuthenticated 尚未更新）
  await nextTick()
  try {
    // H5 重定向：未登录访问 H5 页面 → 登录后跳回
    const h5Redirect = sessionStorage.getItem('h5_redirect')
    if (h5Redirect) {
      sessionStorage.removeItem('h5_redirect')
      await router.push(h5Redirect)
    } else if (isMobileDevice()) {
      // 移动端自动进入 H5
      await router.push('/h5/tasks')
    } else {
      await router.push({ name: 'home' })
    }
  } catch (e: any) {
    // 重复导航（已在首页）不属于错误，忽略
    if (e?.code !== 'NAVIGATION_DUPLICATE') {
      console.warn('[login] push failed, fallback to reload:', e)
      // 兜底：直接修改 URL 并刷新
      window.location.href = '/'
    }
  }
  // ④ 后台异步合并云端数据（不阻塞页面渲染）
  mergeFromCloud()
}

async function handlePhoneSubmit() {
  if (!phoneValid.value || auth.loading) return

  const result = await auth.checkPhoneAndLogin(phone.value)

  if (result === 'loggedIn') {
    // 已注册用户 → 直接进入
    onLoginSuccess()
  } else {
    // 未注册 → 进入验证码步骤
    step.value = 'verify'
  }
}

async function handleVerify() {
  if (!codeValid.value || auth.loading) return
  const ok = await auth.verifyAndRegister(code.value)
  if (ok) {
    onLoginSuccess()
  }
}

// 输入6位验证码后自动提交
function onCodeInput() {
  if (codeValid.value && !auth.loading) {
    handleVerify()
  }
}

function handleBack() {
  step.value = 'phone'
  code.value = ''
  auth.error = ''
}
</script>

<template>
  <div class="login-page">
    <!-- Background decorations -->
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    <div class="bg-orb orb-3"></div>

    <!-- Left panel: Branding -->
    <div class="login-left">
      <div class="left-content">
        <div class="brand-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <h1 class="left-title">清记</h1>
        <p class="left-subtitle">你的个人高效记事本</p>

        <div class="clock-widget">
          <div class="clock-time-track">
            <Transition name="flip" mode="out-in">
              <span class="clock-time" :key="currentTime">{{ currentTime }}</span>
            </Transition>
          </div>
          <span class="clock-date">{{ currentDate }}</span>
        </div>

        <ul class="feature-list">
          <li class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>快速记录，闪电同步</span>
          </li>
          <li class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>全文搜索，精准定位</span>
          </li>
          <li class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>多端同步，本地优先</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Right panel: Login form -->
    <div class="login-right">
      <div class="form-card">
        <h2 class="form-title">欢迎回来</h2>
        <p class="form-desc">登录你的笔记本</p>

        <!-- Step 1: Phone -->
        <div v-if="step === 'phone'" class="form-body">
          <div class="input-field">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <input
              v-model="phone"
              type="tel"
              maxlength="11"
              placeholder="请输入手机号"
              class="field-input"
              @keyup.enter="handlePhoneSubmit"
            />
          </div>
          <button
            class="btn-submit"
            :disabled="!phoneValid || auth.loading"
            @click="handlePhoneSubmit"
          >
            {{ auth.loading ? '验证中...' : '登录' }}
          </button>
          <p class="form-foot">新用户将自动注册账号</p>
        </div>

        <!-- Step 2: Verify (仅未注册用户) -->
        <div v-else class="form-body">
          <p class="verify-phone">
            手机号 <strong>{{ auth.pendingPhone }}</strong> 尚未注册
          </p>
          <div class="verify-code-display">
            <span class="code-label">验证码</span>
            <span class="code-value">{{ auth.verifyCode }}</span>
          </div>
          <div class="input-field">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              v-model="code"
              type="text"
              maxlength="6"
              placeholder="请输入6位验证码"
              class="field-input"
              @input="onCodeInput"
              @keyup.enter="handleVerify"
            />
          </div>
          <button
            class="btn-submit"
            :disabled="!codeValid || auth.loading"
            @click="handleVerify"
          >
            {{ auth.loading ? '注册中...' : '注册并登录' }}
          </button>
          <button class="btn-back" @click="handleBack">返回修改手机号</button>
        </div>

        <!-- Error -->
        <div v-if="auth.error" class="form-error">{{ auth.error }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'LoginView' }
</script>

<style scoped>
/* ============================================================
   Login page — split layout, success-green accent (system-consistent)
   ============================================================ */

.login-page {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, var(--color-bg-1) 0%, var(--color-success-light) 40%, var(--color-bg-2) 100%);
  position: relative;
  overflow: hidden;
}

/* ---- Floating background orbs ---- */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.orb-1 {
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, transparent 70%);
  top: -80px;
  right: -60px;
}

.orb-2 {
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-success) 10%, transparent) 0%, transparent 70%);
  bottom: -40px;
  left: 10%;
}

.orb-3 {
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-success) 8%, transparent) 0%, transparent 70%);
  top: 50%;
  left: 45%;
  transform: translateY(-50%);
}

/* ---- Left panel ---- */
.login-left {
  flex: 0 0 460px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  position: relative;
  z-index: 1;
}

.left-content {
  max-width: 380px;
}

.brand-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--color-success-light);
  color: var(--color-success-text);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.left-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0 0 8px;
}

.left-subtitle {
  font-size: 15px;
  color: var(--color-text-3);
  margin: 0 0 36px;
  line-height: 1.4;
}

/* Clock */
.clock-widget {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 32px;
}

.clock-time-track {
  overflow: hidden;
  height: 48px;
  display: flex;
  align-items: center;
}

.clock-time {
  font-size: 40px;
  font-weight: 700;
  color: var(--color-text-1);
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  white-space: nowrap;
}

.clock-date {
  font-size: 14px;
  color: var(--color-text-3);
}

/* Flip transition */
.flip-enter-active,
.flip-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.flip-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

/* Feature list */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--color-text-2);
}

.feature-item svg {
  flex-shrink: 0;
  color: var(--color-success);
}

/* ---- Right panel ---- */
.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  position: relative;
  z-index: 1;
}

.form-card {
  width: 420px;
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 44px 40px;
  box-shadow: 0 4px 30px var(--color-shadow), 0 1px 3px var(--color-shadow-md);
  border: 1px solid var(--color-border-light);
}

.form-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0 0 6px;
}

.form-desc {
  font-size: 14px;
  color: var(--color-text-3);
  margin: 0 0 28px;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Input field with icon */
.input-field {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 14px;
  color: var(--color-text-3);
  pointer-events: none;
  z-index: 1;
}

.field-input {
  width: 100%;
  padding: 13px 16px 13px 42px;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  font-size: 14px;
  color: var(--color-text-1);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field-input::placeholder {
  color: var(--color-text-4);
}

.field-input:focus {
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 12%, transparent);
}

/* Submit button */
.btn-submit {
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: var(--color-success);
  color: var(--color-white);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  margin-top: 4px;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-success-text);
}

.btn-submit:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-submit:disabled {
  background: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
  cursor: not-allowed;
}

.form-foot {
  font-size: 12px;
  color: var(--color-text-4);
  text-align: center;
  margin: 0;
}

/* Verify step */
.verify-phone {
  font-size: 13px;
  color: var(--color-text-2);
  margin: 0;
  text-align: center;
}

.verify-phone strong {
  color: var(--color-text-1);
}

.verify-code-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
  border: 1.5px dashed color-mix(in srgb, var(--color-success-text) 40%, var(--color-border));
  border-radius: 10px;
}

.code-label {
  font-size: 12px;
  color: var(--color-success-text);
}

.code-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-success);
  letter-spacing: 4px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

.btn-back {
  border: none;
  background: none;
  color: var(--color-text-3);
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
  text-align: center;
}

.btn-back:hover {
  color: var(--color-success-text);
}

/* Error */
.form-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--color-danger-light);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-danger-text);
  text-align: center;
}

/* ---- Responsive ---- */
@media (max-width: 860px) {
  .login-page {
    flex-direction: column;
  }

  .login-left {
    flex: 0 0 auto;
    padding: 40px 32px 20px;
  }

  .left-content {
    max-width: 100%;
    text-align: center;
  }

  .brand-icon-wrap {
    margin: 0 auto 16px;
  }

  .clock-widget {
    display: none;
  }

  .feature-list {
    display: none;
  }

  .left-title {
    font-size: 24px;
  }

  .left-subtitle {
    margin-bottom: 0;
  }

  .login-right {
    flex: 1;
    padding: 20px 24px 40px;
    align-items: flex-start;
  }

  .form-card {
    width: 100%;
    max-width: 420px;
    padding: 32px 28px;
  }
}
</style>
