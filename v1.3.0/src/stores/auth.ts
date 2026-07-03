import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session } from '@/types'
import {
  getSession,
  saveSession,
  clearSession,
  findUserByPhone,
  registerUser,
  updateLastLogin,
  updateNickname,
  generateVerifyCode,
} from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  // 响应式跟踪 session 是否存在（localStorage 本身非响应式，用 ref 桥接）
  const hasSession = ref(!!getSession())
  const loading = ref(false)
  const error = ref('')

  // 验证码相关状态
  const verifyCode = ref('')
  const pendingPhone = ref('')
  const pendingUserExists = ref(false) // 手机号是否已注册

  const isAuthenticated = computed(() => user.value !== null || hasSession.value)

  const userId = computed(() => user.value?.id ?? '')

  /** 初始化：先同步恢复 user（消除登录页闪烁），再异步拉取最新信息 */
  async function init() {
    const session = getSession()
    hasSession.value = !!session
    if (!session) return

    // ① 立即从 session 同步恢复 user，确保 isAuthenticated 立刻为 true
    user.value = {
      id: session.userId,
      phone: session.phone,
      nickname: session.nickname,
      createdAt: '',
      lastLoginAt: '',
    }

    // ② 后台异步从 Supabase 拉取最新信息（静默更新，不阻塞渲染）
    try {
      const found = await findUserByPhone(session.phone)
      if (found) {
        user.value = found
        await updateLastLogin(found.id)
      } else {
        // 云端用户已不存在 → 清除
        user.value = null
        clearSession()
        hasSession.value = false
      }
    } catch {
      // 离线时保持从 session 恢复的数据不变
    }
  }

  /**
   * 检查手机号并决定登录方式
   * - 已注册 → 直接登录，返回 true
   * - 未注册 → 生成验证码存入内存，返回 false（由 UI 展示验证码步骤）
   */
  async function checkPhoneAndLogin(phone: string): Promise<'loggedIn' | 'needVerify'> {
    error.value = ''
    pendingPhone.value = phone
    loading.value = true

    try {
      const found = await findUserByPhone(phone)
      if (found) {
        // 已注册 → 直接登录
        user.value = found
        await updateLastLogin(found.id)
        saveSession(found)
        hasSession.value = true
        pendingPhone.value = ''
        return 'loggedIn'
      } else {
        // 未注册 → 生成验证码，等待用户输入
        pendingUserExists.value = false
        verifyCode.value = generateVerifyCode()
        return 'needVerify'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '检查失败，请重试'
      return 'needVerify'
    } finally {
      loading.value = false
    }
  }

  /** 验证码校验 + 注册（MVP：任何6位数字均可通过） */
  async function verifyAndRegister(code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) {
      error.value = '请输入6位验证码'
      return false
    }

    loading.value = true
    error.value = ''

    try {
      // 注册新用户
      const newUser = await registerUser(pendingPhone.value)
      user.value = newUser
      saveSession(newUser)
      hasSession.value = true
      verifyCode.value = ''
      pendingPhone.value = ''
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '注册失败，请重试'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 */
  function logout() {
    user.value = null
    hasSession.value = false
    clearSession()
  }

  /** 修改昵称 */
  async function changeNickname(nickname: string) {
    if (!user.value) return
    try {
      await updateNickname(user.value.id, nickname)
      user.value.nickname = nickname
      // 更新 session
      const session = getSession()
      if (session) {
        session.nickname = nickname
        localStorage.setItem('cleannote_session', JSON.stringify(session))
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '修改昵称失败'
    }
  }

  return {
    user,
    loading,
    error,
    verifyCode,
    pendingPhone,
    pendingUserExists,
    isAuthenticated,
    userId,
    init,
    checkPhoneAndLogin,
    verifyAndRegister,
    logout,
    changeNickname,
  }
})
