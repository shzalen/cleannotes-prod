/**
 * Supabase Client — 统一管理认证与数据访问
 *
 * 认证方式：Supabase Auth（邮箱+密码），JWT 自动管理
 * 数据访问：仍通过 raw fetch 调用 REST API，但 Authorization header
 *           改用用户 JWT（由 auth state listener 缓存到模块变量）
 */

import { createClient } from '@supabase/supabase-js'

// R2-S01: Remove hardcoded fallback — require environment variables at build time
const _url = import.meta.env.VITE_SUPABASE_URL
const _key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!_url || !_key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in credentials.'
  )
}
export const SUPABASE_URL = _url
export const SUPABASE_KEY = _key

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// ---- JWT 缓存（供 supabase.ts 的 raw fetch 使用） ----

let cachedAccessToken: string | null = null

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken
}

/**
 * 同步获取当前登录用户 ID（从 Supabase localStorage 读取）
 * 用于 localStorage key 前缀等场景，不依赖 Pinia
 */
export function getCurrentUserIdSync(): string {
  try {
    const raw = localStorage.getItem('sb-ghkyhbxltdxhkhpqltdr-auth-token')
    if (!raw) return ''
    const session = JSON.parse(raw)
    return session?.user?.id ?? ''
  } catch {
    return ''
  }
}
