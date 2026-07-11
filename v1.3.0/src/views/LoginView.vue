<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGrowthStore } from '@/stores/growth'
import { switchUser } from '@/services/storage'
import { useTaskStore } from '@/stores/task'
import { useTodoStore } from '@/stores/todo'
import { useMemoStore } from '@/stores/memo'
import { useWeeklyReportStore } from '@/stores/weeklyReport'
import { useGrowthIntegration } from '@/composables/useGrowthIntegration'
import { migrateOldUser } from '@/services/migration'
import { useRouter } from 'vue-router'
import { isMobileDevice } from '@/utils/device'

const auth = useAuthStore()
const taskStore = useTaskStore()
const growthStore = useGrowthStore()
const todoStore = useTodoStore()
const memoStore = useMemoStore()
const weeklyReportStore = useWeeklyReportStore()
const router = useRouter()

// ---- 邮箱认证 ----
const email = ref('')
const pw = ref('')
const pwConfirm = ref('')
const nickname = ref('')
const showPw = ref(false)
const mode = ref<'login' | 'register' | 'migrate'>('login')
const migratePhone = ref('')
const migrateMsg = ref('')
const migrating = ref(false)

const phoneValid = computed(() => /^1\d{10}$/.test(migratePhone.value))
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const pwValid = computed(() => pw.value.length >= 8)
const pwConfirmValid = computed(() => pwConfirm.value === pw.value && pwConfirm.value.length >= 8)

async function handleSubmit() {
  if (!emailValid.value || !pwValid.value || auth.loading) return
  if (mode.value === 'register' && !pwConfirmValid.value) return

  if (mode.value === 'login') {
    const ok = await auth.signIn(email.value, pw.value)
    if (ok) onLoginSuccess()
  } else if (mode.value === 'register') {
    const ok = await auth.signUp(email.value, pw.value, nickname.value || undefined)
    if (ok) onLoginSuccess()
  }
}

async function handleMigrate() {
  if (!phoneValid.value || !emailValid.value || !pwValid.value || !pwConfirmValid.value || migrating.value) return
  migrating.value = true
  migrateMsg.value = ''
  try {
    const result = await migrateOldUser(
      migratePhone.value,
      email.value,
      pw.value,
      nickname.value || undefined,
    )
    if (result.success && result.user) {
      // 迁移成功，设置 auth store 并加载
      auth.user = result.user
      migrateMsg.value = result.oldNickname
        ? `迁移成功！已继承旧账号数据，昵称：${result.oldNickname}`
        : '迁移成功！已继承旧账号数据'
      onLoginSuccess()
    } else if (result.needsVerification) {
      migrateMsg.value = result.error || '请先验证邮箱'
    } else {
      migrateMsg.value = result.error || '迁移失败'
    }
  } catch (e) {
    migrateMsg.value = e instanceof Error ? e.message : '迁移失败，请重试'
  } finally {
    migrating.value = false
  }
}

function switchMode() {
  if (mode.value === 'login') mode.value = 'register'
  else if (mode.value === 'register') mode.value = 'login'
  pw.value = ''
  pwConfirm.value = ''
  auth.error = ''
  migrateMsg.value = ''
}

function enterMigrateMode() {
  mode.value = 'migrate'
  pw.value = ''
  pwConfirm.value = ''
  auth.error = ''
  migrateMsg.value = ''
}

function exitMigrateMode() {
  mode.value = 'login'
  migratePhone.value = ''
  pw.value = ''
  pwConfirm.value = ''
  auth.error = ''
  migrateMsg.value = ''
}

async function handleForgotPassword() {
  if (!emailValid.value) {
    auth.error = '请先输入邮箱地址'
    return
  }
  await auth.sendPasswordReset(email.value)
}

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

/** 清除旧 localStorage 数据（保留主题和设备偏好，Supabase auth token 由 SDK 管理） */
function clearOldLocalStorage() {
  const PRESERVE = new Set(['cleannotes_theme', 'cleannotes_force_pc'])
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if ((key.startsWith('cleannotes_') || key.startsWith('cleannote_')) && !PRESERVE.has(key)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

/** 处理登录/注册成功后的数据加载和跳转 */
async function onLoginSuccess() {
  // 清除旧 localStorage 数据，以数据库为准
  clearOldLocalStorage()
  switchUser(auth.userId)
  // 从 Supabase 加载数据
  await Promise.all([
    taskStore.load(),
    growthStore.load(),
    todoStore.load(),
    memoStore.load(),
    weeklyReportStore.load(),
  ])
  // 注册成长系统回调
  useGrowthIntegration()
  // 等待响应式更新完成，再跳转
  await nextTick()
  try {
    const h5Redirect = sessionStorage.getItem('h5_redirect')
    if (h5Redirect) {
      sessionStorage.removeItem('h5_redirect')
      await router.push(h5Redirect)
    } else if (isMobileDevice()) {
      await router.push('/h5/tasks')
    } else {
      await router.push({ name: 'home' })
    }
  } catch (e: any) {
    if (e?.code !== 'NAVIGATION_DUPLICATE') {
      console.warn('[login] push failed, fallback to reload:', e)
      window.location.href = '/'
    }
  }
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
        <h2 class="form-title">
          {{ mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账户' : '旧用户迁移' }}
        </h2>
        <p class="form-desc">
          {{ mode === 'login' ? '使用邮箱和密码登录' : mode === 'register' ? '使用邮箱注册新账户' : '输入旧手机号和新邮箱，迁移历史数据' }}
        </p>

        <!-- 旧用户迁移模式 -->
        <div v-if="mode === 'migrate'" class="form-body">
            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <input
                v-model="migratePhone"
                type="tel"
                maxlength="11"
                placeholder="旧账号手机号"
                class="field-input"
                @keyup.enter="handleMigrate()"
              />
            </div>

            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                v-model="email"
                type="email"
                maxlength="64"
                placeholder="新邮箱地址"
                class="field-input"
                @keyup.enter="handleMigrate()"
              />
            </div>

            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                v-model="pw"
                :type="showPw ? 'text' : 'password'"
                maxlength="64"
                placeholder="新密码（至少8位）"
                class="field-input has-toggle"
                @keyup.enter="handleMigrate()"
              />
              <button type="button" class="pw-toggle" :title="showPw ? '隐藏' : '显示'" @click="showPw = !showPw">
                <svg v-if="showPw" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>

            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                v-model="pwConfirm"
                :type="showPw ? 'text' : 'password'"
                maxlength="64"
                placeholder="确认新密码"
                class="field-input has-toggle"
                @keyup.enter="handleMigrate()"
              />
            </div>

            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                v-model="nickname"
                type="text"
                maxlength="20"
                placeholder="新昵称（可选，默认继承旧昵称）"
                class="field-input"
                @keyup.enter="handleMigrate()"
              />
            </div>

            <button
              class="btn-submit"
              :disabled="!phoneValid || !emailValid || !pwValid || !pwConfirmValid || migrating"
              @click="handleMigrate()"
            >
              {{ migrating ? '迁移中...' : '迁移数据' }}
            </button>

            <div class="form-actions">
              <span class="form-link" @click="exitMigrateMode">返回登录</span>
            </div>
          </div>

        <!-- 登录/注册模式 -->
        <div v-else class="form-body">
            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                v-model="email"
                type="email"
                maxlength="64"
                placeholder="请输入邮箱地址"
                class="field-input"
                @keyup.enter="handleSubmit()"
              />
            </div>

            <div class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                v-model="pw"
                :type="showPw ? 'text' : 'password'"
                maxlength="64"
                placeholder="请输入密码（至少8位）"
                class="field-input has-toggle"
                @keyup.enter="handleSubmit()"
              />
              <button
                type="button"
                class="pw-toggle"
                :title="showPw ? '隐藏密码' : '显示密码'"
                @click="showPw = !showPw"
              >
                <svg v-if="showPw" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>

            <!-- 注册模式：确认密码 + 昵称 -->
            <div v-if="mode === 'register'" class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                v-model="pwConfirm"
                :type="showPw ? 'text' : 'password'"
                maxlength="64"
                placeholder="请再次输入密码"
                class="field-input has-toggle"
                @keyup.enter="handleSubmit()"
              />
            </div>

            <div v-if="mode === 'register'" class="input-field">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                v-model="nickname"
                type="text"
                maxlength="20"
                placeholder="昵称（可选，默认用邮箱前缀）"
                class="field-input"
                @keyup.enter="handleSubmit()"
              />
            </div>

            <button
              class="btn-submit"
              :disabled="(mode === 'login'
                ? (!emailValid || !pwValid)
                : (!emailValid || !pwValid || !pwConfirmValid)) || auth.loading"
              @click="handleSubmit()"
            >
              {{ auth.loading ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
            </button>

            <div class="form-actions">
              <span class="form-link" @click="switchMode">
                {{ mode === 'login' ? '没有账户？去注册' : '已有账户？去登录' }}
              </span>
              <span v-if="mode === 'login'" class="form-link muted" @click="handleForgotPassword">忘记密码？</span>
            </div>
          </div>

        <!-- Error / Verification notice -->
        <div v-if="auth.error" :class="['form-msg', auth.needsVerification ? 'form-msg-info' : 'form-error']">
          {{ auth.error }}
        </div>

        <!-- Migration message -->
        <div v-if="migrateMsg" :class="['form-msg', migrating ? 'form-msg-info' : (migrateMsg.includes('成功') ? 'form-msg-info' : 'form-error')]">
          {{ migrateMsg }}
        </div>

        <!-- Migration entry link (only on login mode) -->
        <div v-if="mode === 'login'" class="migrate-entry" @click="enterMigrateMode">
          旧用户数据迁移
        </div>
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

/* Password field with show/hide toggle */
.field-input.has-toggle {
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}

.pw-toggle:hover {
  color: var(--color-success-text);
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
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

/* Form actions (links) */
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.form-link {
  font-size: 13px;
  color: var(--color-success-text);
  cursor: pointer;
  transition: opacity 0.2s;
}

.form-link:hover {
  opacity: 0.8;
}

.form-link.muted {
  color: var(--color-text-3);
}

/* Error / Info messages */
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

.form-msg-info {
  margin-top: 12px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-success-text);
  text-align: center;
}

/* Migration entry link */
.migrate-entry {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-4);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}

.migrate-entry:hover {
  color: var(--color-text-2);
  background: color-mix(in srgb, var(--color-surface) 50%, transparent);
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
