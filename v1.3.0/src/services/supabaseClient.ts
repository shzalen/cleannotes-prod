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

// P1-07: Cache userId from auth state changes instead of parsing localStorage
let cachedUserId: string = ''

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken
}

/** P1-07: Cache user ID when auth state changes (called from auth store) */
export function setCachedUserId(userId: string) {
  cachedUserId = userId
}

/**
 * 同步获取当前登录用户 ID
 * P1-07: Prefer cached value set by auth state listener.
 * Falls back to Supabase localStorage key if cache is not yet populated.
 */
export function getCurrentUserIdSync(): string {
  if (cachedUserId) return cachedUserId
  try {
    // Fallback: read from Supabase localStorage key
    const projectRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`)
    if (!raw) return ''
    const session = JSON.parse(raw)
    const userId = session?.user?.id ?? ''
    if (userId) cachedUserId = userId // populate cache for future calls
    return userId
  } catch {
    return ''
  }
}
