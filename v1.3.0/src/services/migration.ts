/**
 * 旧用户数据迁移服务
 *
 * 流程：
 * 1. 用邮箱+密码在 Supabase Auth 注册新账号
 * 2. 调用 RPC migrate_user_data 将旧手机号关联的数据迁移到新账号
 * 3. 迁移成功后自动登录，前端拉取云端数据
 */

import { supabaseClient, setCachedAccessToken } from './supabaseClient'
import type { User } from '@/types'

export interface MigrationResult {
  success: boolean
  error?: string
  needsVerification?: boolean
  oldNickname?: string
  user?: User
}

/**
 * 旧用户迁移：通过手机号关联旧数据，创建新邮箱账号
 */
export async function migrateOldUser(
  phone: string,
  email: string,
  password: string,
  nickname?: string,
): Promise<MigrationResult> {
  // 1. 注册新 Supabase Auth 账号
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
    return { success: false, error: error.message }
  }

  // 如果需要邮箱验证，session 为 null
  if (!data.session) {
    return {
      success: false,
      needsVerification: true,
      error: '验证邮件已发送，请先查收邮箱完成验证，再登录后使用迁移功能',
    }
  }

  // 2. 设置 JWT
  setCachedAccessToken(data.session.access_token)

  // 3. 调用 RPC 迁移旧数据
  const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
    'migrate_user_data',
    { p_phone: phone },
  )

  if (rpcError) {
    return {
      success: false,
      error: `迁移失败：${rpcError.message}。新账号已创建，请联系管理员手动迁移数据。`,
    }
  }

  // RPC 返回 { success: boolean, old_nickname: string | null, msg: string | null }
  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult

  if (!result?.success) {
    return {
      success: false,
      error: result?.msg || '迁移失败，旧手机号可能不存在或已迁移',
    }
  }

  // 4. 如果旧用户有昵称且未提供新昵称，使用旧昵称
  let finalNickname = nickname
  if (!finalNickname && result?.old_nickname) {
    finalNickname = result.old_nickname
    // 更新 Supabase Auth 用户元数据中的昵称
    await supabaseClient.auth.updateUser({
      data: { nickname: finalNickname },
    })
  }

  // 5. 获取完整用户信息
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (!session?.user) {
    return { success: false, error: '迁移成功但获取用户信息失败' }
  }

  const user: User = {
    id: session.user.id,
    email: session.user.email ?? '',
    nickname: finalNickname || session.user.user_metadata?.nickname || session.user.email?.split('@')[0] || '用户',
    createdAt: session.user.created_at ?? '',
    lastLoginAt: session.user.last_sign_in_at ?? '',
  }

  return {
    success: true,
    oldNickname: result?.old_nickname || undefined,
    user,
  }
}
