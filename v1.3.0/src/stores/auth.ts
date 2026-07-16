import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import {
  signUpWithEmail,
  signInWithEmail,
  signOut as authSignOut,
  getCurrentUser,
  updatePassword as authUpdatePassword,
  updateNickname as authUpdateNickname,
  resetPassword as authResetPassword,
  onAuthStateChange,
} from '@/services/auth'
import { setCachedAccessToken, setCachedUserId } from '@/services/supabaseClient'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref('')
  const needsVerification = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const userId = computed(() => user.value?.id ?? '')

  /** 会话恢复是否已执行（幂等标志，供路由守卫等待，修复刷新回首页问题） */
  const initialized = ref(false)

  let unsubAuth: (() => void) | null = null

  /** 初始化：从 Supabase 恢复会话，注册 auth state listener */
  async function init() {
    // 幂等：会话恢复只执行一次，后续调用直接返回
    if (initialized.value) return
    // 注册认证状态变化监听（token 刷新时自动更新 cached token）
    if (!unsubAuth) {
      unsubAuth = onAuthStateChange((authUser) => {
        if (authUser) {
          user.value = authUser
          // P1-07: Cache userId for synchronous access (crypto, storage keys)
          setCachedUserId(authUser.id)
        } else {
          user.value = null
          setCachedUserId('')
        }
      })
    }

    // 从 Supabase 缓存恢复会话
    const currentUser = await getCurrentUser()
    if (currentUser) {
      user.value = currentUser
    }
    initialized.value = true
  }

  /** 邮箱密码登录 */
  async function signIn(email: string, password: string): Promise<boolean> {
    error.value = ''
    loading.value = true
    try {
      const result = await signInWithEmail(email, password)
      if (result.status === 'error') {
        error.value = result.error || '登录失败'
        return false
      }
      // 登录成功后获取用户信息
      const currentUser = await getCurrentUser()
      if (currentUser) {
        user.value = currentUser
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '登录失败，请重试'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 邮箱密码注册 */
  async function signUp(email: string, password: string, nickname?: string): Promise<boolean> {
    error.value = ''
    loading.value = true
    needsVerification.value = false
    try {
      const result = await signUpWithEmail(email, password, nickname)
      if (result.status === 'error') {
        error.value = result.error || '注册失败'
        return false
      }
      if (result.status === 'needsVerification') {
        needsVerification.value = true
        error.value = '验证邮件已发送，请查收邮箱后登录'
        return false
      }
      // 注册成功并自动登录
      const currentUser = await getCurrentUser()
      if (currentUser) {
        user.value = currentUser
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '注册失败，请重试'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 — 立即清除缓存 token，signOut 后台执行 (S-04) */
  function logout() {
    setCachedAccessToken(null) // 立即清除，不依赖网络请求
    setCachedUserId('') // P1-07: Clear cached userId
    authSignOut().catch(() => {}) // 后台执行，失败不阻塞
    user.value = null
  }

  /** R4-P04: Unsubscribe Supabase Auth state listener (call on logout) */
  function cleanup() {
    if (unsubAuth) {
      unsubAuth()
      unsubAuth = null
    }
  }

  /** 修改密码 */
  async function changePassword(newPassword: string): Promise<boolean> {
    if (!user.value) {
      error.value = '未登录'
      return false
    }
    if (newPassword.length < 8) {
      error.value = '密码长度至少 8 位'
      return false
    }
    error.value = ''
    loading.value = true
    try {
      const result = await authUpdatePassword(newPassword)
      if (!result.success) {
        error.value = result.error || '修改密码失败'
        return false
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '修改密码失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 修改昵称 */
  async function changeNickname(nickname: string): Promise<boolean> {
    if (!user.value) {
      error.value = '未登录'
      return false
    }
    error.value = ''
    try {
      const result = await authUpdateNickname(nickname)
      if (result.success) {
        user.value.nickname = nickname
        return true
      } else {
        error.value = result.error || '修改昵称失败'
        return false
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '修改昵称失败'
      return false
    }
  }

  /** 发送密码重置邮件 */
  async function sendPasswordReset(email: string): Promise<boolean> {
    error.value = ''
    try {
      const result = await authResetPassword(email)
      if (!result.success) {
        error.value = result.error || '发送重置邮件失败'
        return false
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送重置邮件失败'
      return false
    }
  }

  return {
    user,
    loading,
    error,
    needsVerification,
    isAuthenticated,
    userId,
    initialized,
    init,
    signIn,
    signUp,
    logout,
    cleanup,
    changePassword,
    changeNickname,
    sendPasswordReset,
  }
})
