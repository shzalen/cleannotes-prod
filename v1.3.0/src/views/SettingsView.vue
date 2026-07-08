<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useAuthStore } from '@/stores/auth'
import { useAiStore } from '@/stores/ai'
import { isOnline } from '@/services/storage'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { findUserByPhoneWithCredentials } from '@/services/auth'

const timerStore = useTimerStore()
const auth = useAuthStore()
const aiStore = useAiStore()
const { mode: themeMode, isDark, setTheme } = useTheme()

const workStart = ref('09:00')
const workEnd = ref('18:00')
const saved = ref(false)
const nicknameEdit = ref('')
const nicknameSaved = ref(false)

// 密码修改
const hasPassword = ref(false)
const pwCurrent = ref('')
const pwNew = ref('')
const pwNewConfirm = ref('')
const showPwCurrent = ref(false)
const showPwNew = ref(false)
const pwSaving = ref(false)
const pwSaved = ref(false)
const pwError = ref('')

const pwCurrentValid = computed(() => pwCurrent.value.length >= 8 || !hasPassword.value)
const pwNewValid = computed(() => pwNew.value.length >= 8)
const pwConfirmValid = computed(() => pwNew.value.length >= 8 && pwNew.value === pwNewConfirm.value)

// AI 配置
const aiApiUrl = ref('')
const aiApiKey = ref('')
const aiModel = ref('')
const aiSaved = ref(false)
const showApiKey = ref(false)

const displayPhone = computed(() => {
  const p = auth.user?.phone || ''
  if (p.length >= 11) return p.slice(0, 3) + '****' + p.slice(7)
  return p
})

const maskedApiKey = computed(() => {
  const key = aiApiKey.value
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
})

onMounted(async () => {
  await timerStore.load()
  workStart.value = timerStore.config.workStart
  workEnd.value = timerStore.config.workEnd
  nicknameEdit.value = auth.user?.nickname || ''

  await aiStore.load()
  aiApiUrl.value = aiStore.config.apiUrl
  aiApiKey.value = aiStore.config.apiKey
  aiModel.value = aiStore.config.model

  // 检查是否已设置密码
  if (auth.user) {
    try {
      const creds = await findUserByPhoneWithCredentials(auth.user.phone)
      hasPassword.value = !!(creds?.passwordHash && creds?.passwordSalt)
    } catch { /* 离线时静默 */ }
  }
})

async function handleChangePassword() {
  pwError.value = ''
  pwSaved.value = false
  if (!pwNewValid.value || !pwConfirmValid.value) return
  if (hasPassword.value && !pwCurrentValid.value) {
    pwError.value = '请输入当前密码'
    return
  }
  pwSaving.value = true
  try {
    const ok = await auth.changePassword(
      hasPassword.value ? pwCurrent.value : '',
      pwNew.value,
    )
    if (ok) {
      hasPassword.value = true
      pwCurrent.value = ''
      pwNew.value = ''
      pwNewConfirm.value = ''
      pwSaved.value = true
      setTimeout(() => pwSaved.value = false, 2000)
    } else {
      pwError.value = auth.error || '修改失败'
    }
  } finally {
    pwSaving.value = false
  }
}

async function saveTimer() {
  timerStore.config.workStart = workStart.value
  timerStore.config.workEnd = workEnd.value
  await timerStore.save()
  saved.value = true
  setTimeout(() => saved.value = false, 2000)
}

async function saveNickname() {
  if (!nicknameEdit.value.trim()) return
  await auth.changeNickname(nicknameEdit.value.trim())
  nicknameSaved.value = true
  setTimeout(() => nicknameSaved.value = false, 2000)
}

async function saveAiConfig() {
  aiStore.config.apiUrl = aiApiUrl.value.trim()
  aiStore.config.apiKey = aiApiKey.value.trim()
  aiStore.config.model = aiModel.value.trim()
  await aiStore.persistConfig()
  aiSaved.value = true
  setTimeout(() => aiSaved.value = false, 2000)
}
</script>

<template>
  <div class="settings-view">
    <!-- Page header -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">
          设置
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="header-icon">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </h2>
      </div>
    </div>

    <!-- Content -->
    <div class="settings-content">
      <div class="sc-grid">

        <!-- Left column -->
        <div class="sc-col">

          <!-- Account -->
          <div class="sc-card">
            <h3 class="sc-title">账号信息</h3>
            <div class="form-row">
              <div class="form-group">
                <label>手机号</label>
                <input :value="displayPhone" type="text" disabled />
              </div>
              <div class="form-group">
                <label>昵称</label>
                <div class="input-with-btn">
                  <input v-model="nicknameEdit" type="text" placeholder="设置昵称" />
                  <button class="btn-sm" @click="saveNickname">
                    {{ nicknameSaved ? '已保存' : '保存' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Change Password -->
          <div class="sc-card">
            <h3 class="sc-title">{{ hasPassword ? '修改密码' : '设置密码' }}</h3>
            <div class="form-group full" v-if="hasPassword">
              <label>当前密码</label>
              <div class="input-with-btn">
                <input
                  :type="showPwCurrent ? 'text' : 'password'"
                  v-model="pwCurrent"
                  placeholder="请输入当前密码"
                />
                <button class="btn-sm-ghost" @click="showPwCurrent = !showPwCurrent" :title="showPwCurrent ? '隐藏' : '显示'">
                  <svg v-if="!showPwCurrent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="form-group full">
              <label>新密码</label>
              <div class="input-with-btn">
                <input
                  :type="showPwNew ? 'text' : 'password'"
                  v-model="pwNew"
                  placeholder="至少8位字符"
                />
                <button class="btn-sm-ghost" @click="showPwNew = !showPwNew" :title="showPwNew ? '隐藏' : '显示'">
                  <svg v-if="!showPwNew" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="form-group full">
              <label>确认新密码</label>
              <input
                :type="showPwNew ? 'text' : 'password'"
                v-model="pwNewConfirm"
                placeholder="再次输入新密码"
              />
            </div>
            <div v-if="pwError" class="pw-error">{{ pwError }}</div>
            <button
              class="btn-primary"
              :disabled="pwSaving || !pwNewValid || !pwConfirmValid || (hasPassword && !pwCurrentValid)"
              @click="handleChangePassword"
            >
              {{ pwSaving ? '保存中...' : (pwSaved ? '已保存' : (hasPassword ? '修改密码' : '设置密码')) }}
            </button>
          </div>

          <!-- Work Time -->
          <div class="sc-card">
            <h3 class="sc-title">上下班时间</h3>
            <div class="form-row">
              <div class="form-group">
                <label>上班时间</label>
                <input v-model="workStart" type="time" />
              </div>
              <div class="form-group">
                <label>下班时间</label>
                <input v-model="workEnd" type="time" />
              </div>
            </div>
            <button class="btn-primary" @click="saveTimer">
              {{ saved ? '已保存' : '保存' }}
            </button>
          </div>

          <!-- Sync -->
          <div class="sc-card">
            <h3 class="sc-title">数据同步</h3>
            <div class="sync-info">
              <div class="sync-row">
                <span class="sync-label">云端状态</span>
                <span class="sync-value" :class="isOnline ? 'online' : 'offline'">
                  {{ isOnline ? '已连接' : '未连接' }}
                </span>
              </div>
              <div class="sync-row">
                <span class="sync-label">存储位置</span>
                <span class="sync-value">Supabase + 本地缓存</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="sc-col">

          <!-- Appearance -->
          <div class="sc-card">
            <h3 class="sc-title">外观</h3>
            <div class="theme-options">
              <button
                :class="['theme-btn', { active: themeMode === 'tencent' }]"
                @click="setTheme('tencent')"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="8" fill="#0052D9" stroke="#0052D9"/>
                  <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="white" stroke="none">T</text>
                </svg>
                <span>腾讯蓝</span>
              </button>
              <button
                :class="['theme-btn', { active: themeMode === 'zuru' }]"
                @click="setTheme('zuru')"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="8" fill="#E53935" stroke="#E53935"/>
                  <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="white" stroke="none">Z</text>
                </svg>
                <span>ZURU</span>
              </button>
              <button
                :class="['theme-btn', { active: themeMode === 'dark' }]"
                @click="setTheme('dark')"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <span>深色</span>
              </button>
              <button
                :class="['theme-btn', { active: themeMode === 'auto' }]"
                @click="setTheme('auto')"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <span>跟随系统</span>
              </button>
            </div>
          </div>

          <!-- AI Config -->
          <div class="sc-card">
            <h3 class="sc-title">
              AI 接口配置
              <span class="sc-subtitle">配置 AI 助手使用的 API 服务</span>
            </h3>
            <div class="form-group full">
              <label>API 地址</label>
              <input v-model="aiApiUrl" type="text" placeholder="https://api.openai.com" />
            </div>
            <div class="form-group full">
              <label>API Key</label>
              <div class="input-with-btn">
                <input
                  :type="showApiKey ? 'text' : 'password'"
                  v-model="aiApiKey"
                  placeholder="sk-..."
                />
                <button class="btn-sm-ghost" @click="showApiKey = !showApiKey" :title="showApiKey ? '隐藏' : '显示'">
                  <svg v-if="!showApiKey" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="form-group full">
              <label>模型名称</label>
              <input v-model="aiModel" type="text" placeholder="gpt-4o-mini" />
            </div>
            <div class="ai-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>支持 OpenAI 兼容格式的 API（如 DeepSeek、通义千问等）。可填写基础地址或完整地址，系统会自动补全接口路径。</span>
            </div>
            <button class="btn-primary" @click="saveAiConfig">
              {{ aiSaved ? '已保存' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- Container (matches .tasks-view pattern) ---- */
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
}

/* ---- Page header ---- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 8px;
  flex-shrink: 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: var(--color-text-3);
}

/* ---- Scrollable content ---- */
.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px 24px;
}

/* ---- Two-column grid ---- */
.sc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.sc-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- Card ---- */
.sc-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px 22px;
  transition: border-color 0.15s;
}

.sc-card:hover {
  border-color: var(--color-text-4);
}

.sc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 16px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sc-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-3);
}

/* ---- Form ---- */
.form-row {
  display: flex;
  gap: 14px;
  margin-bottom: 14px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full {
  margin-bottom: 12px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-text-1);
  background: var(--color-bg-3);
  outline: none;
  transition: border-color 0.15s;
}

.form-group input:focus {
  border-color: var(--color-success);
}

.form-group input:disabled {
  color: var(--color-text-3);
  background: var(--color-bg-4);
  cursor: not-allowed;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
}

/* ---- Buttons ---- */
.btn-sm {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: var(--color-success);
  color: var(--color-white);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.btn-sm:hover {
  background: var(--color-success-text);
}

.btn-sm-ghost {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-2);
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-sm-ghost:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.btn-primary {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: var(--color-success);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--color-success-text);
}

/* ---- AI hint ---- */
.ai-hint {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 10px 12px;
  background: var(--color-info-lighter);
  border-radius: 8px;
  margin-bottom: 14px;
}

.ai-hint svg {
  flex-shrink: 0;
  color: var(--color-info);
  margin-top: 1px;
}

.ai-hint span {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
}

/* ---- Sync info ---- */
.sync-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sync-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sync-label {
  font-size: 13px;
  color: var(--color-text-2);
}

.sync-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
}

.sync-value.online {
  color: var(--color-success-text);
}

.sync-value.offline {
  color: var(--color-danger);
}

/* ---- Theme options ---- */
.theme-options {
  display: flex;
  gap: 10px;
}

.theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 10px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.theme-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.theme-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary-light);
}

/* Password error */
.pw-error {
  font-size: 12px;
  color: var(--color-danger-text);
  padding: 6px 10px;
  background: var(--color-danger-light);
  border-radius: 6px;
  margin-bottom: 8px;
}

/* ---- Responsive: single column on narrow screens ---- */
@media (max-width: 700px) {
  .sc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
