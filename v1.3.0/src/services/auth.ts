/**
 * Auth Service — Supabase Auth 邮箱认证
 *
 * 认证方式：邮箱 + 密码（Supabase Auth SDK 管理 JWT + 自动刷新）
 * 用户信息：nickname 存储在 auth.users.user_metadata 中
 */

import { supabaseClient, setCachedAccessToken } from './supabaseClient'
import type { User } from '@/types'

// ---- Supabase Auth 用户映射 ----

function mapAuthUser(authUser: import('@supabase/supabase-js').User): User {
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    nickname: (authUser.user_metadata?.nickname as string) ?? authUser.email?.split('@')[0] ?? '用户',
    createdAt: authUser.created_at ?? '',
    lastLoginAt: authUser.last_sign_in_at ?? '',
  }
}

// ---- 认证操作 ----

/**
 * 邮箱密码注册
 * @returns 'success' | 'needsVerification' | 'error'
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  nickname?: string,
): Promise<{ status: 'success' | 'needsVerification' | 'error'; error?: string }> {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname || email.split('@')[0],
      },
    },
  })

  if (error) {
    return { status: 'error', error: error.message }
  }

  // 如果需要邮箱验证，session 会是 null
  if (!data.session) {
    return { status: 'needsVerification' }
  }

  // 注册成功并自动登录
  setCachedAccessToken(data.session.access_token)
  return { status: 'success' }
}

/**
 * 邮箱密码登录
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ status: 'success' | 'error'; error?: string }> {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { status: 'error', error: error.message }
  }

  setCachedAccessToken(data.session?.access_token ?? null)
  return { status: 'success' }
}

/**
 * 退出登录
 */
export async function signOut(): Promise<void> {
  await supabaseClient.auth.signOut()
  setCachedAccessToken(null)
}

/**
 * 获取当前会话用户（从 Supabase 缓存恢复）
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (!session?.user) return null

  setCachedAccessToken(session.access_token)
  return mapAuthUser(session.user)
}

/**
 * 修改密码（需已登录，Supabase Auth 服务端校验）
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * 修改昵称（存入 user_metadata）
 */
export async function updateNickname(nickname: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseClient.auth.updateUser({
    data: { nickname },
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * 发送密码重置邮件
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email)
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * 监听认证状态变化（token 刷新、登录、退出等）
 */
export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    setCachedAccessToken(session?.access_token ?? null)
    callback(session?.user ? mapAuthUser(session.user) : null)
  })

  // 返回取消订阅函数
  return () => data.subscription.unsubscribe()
}
