/**
 * Auth Service — 手机号注册/登录 + 7天会话管理
 *
 * 流程：输入手机号 → 生成6位验证码（MVP阶段展示在界面上，后续接SMS）→ 验证 → 登录
 * 会话：存储在 localStorage，7天有效
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase'
import type { User, Session } from '@/types'
import { toUTCISO } from '@/utils/time'

const SESSION_KEY = 'cleannote_session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

const headers: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

// ---- Session management ----

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session: Session = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(user: User): void {
  const now = Date.now()
  const session: Session = {
    userId: user.id,
    phone: user.phone,
    nickname: user.nickname,
    loginAt: now,
    expiresAt: now + SESSION_DURATION,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function isSessionValid(): boolean {
  return getSession() !== null
}

// ---- Supabase user operations ----

async function request(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  options?: {
    body?: unknown
    query?: string
    prefer?: string
    userId?: string
  }
): Promise<unknown> {
  const url = `${SUPABASE_URL}/rest/v1/${table}${options?.query ? options.query : ''}`
  const h: Record<string, string> = { ...headers }
  if (options?.prefer) h['Prefer'] = options.prefer
  if (options?.userId) h['x-user-id'] = options.userId

  const res = await fetch(url, {
    method,
    headers: h,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    phone: r.phone as string,
    nickname: (r.nickname as string) || '',
    createdAt: r.created_at as string,
    lastLoginAt: r.last_login_at as string,
  }
}

/** 查找手机号对应的用户 */
export async function findUserByPhone(phone: string): Promise<User | null> {
  const rows = (await request('cleannote_users', 'GET', {
    query: `?phone=eq.${encodeURIComponent(phone)}&limit=1`,
  })) as Record<string, unknown>[]
  return rows.length > 0 ? rowToUser(rows[0]) : null
}

/** 注册新用户 */
export async function registerUser(phone: string, nickname?: string): Promise<User> {
  const id = crypto.randomUUID()
  const now = toUTCISO()
  const body = {
    id,
    phone,
    nickname: nickname || `用户${phone.slice(-4)}`,
    created_at: now,
    last_login_at: now,
  }
  await request('cleannote_users', 'POST', {
    body,
    prefer: 'return=representation',
    userId: id,
  })
  return rowToUser(body as Record<string, unknown>)
}

/** 更新最后登录时间 */
export async function updateLastLogin(userId: string): Promise<void> {
  await request('cleannote_users', 'PATCH', {
    query: `?id=eq.${userId}`,
    body: { last_login_at: toUTCISO() },
    userId,
  })
}

/** 更新用户昵称 */
export async function updateNickname(userId: string, nickname: string): Promise<void> {
  await request('cleannote_users', 'PATCH', {
    query: `?id=eq.${userId}`,
    body: { nickname },
    userId,
  })
}

/** 生成6位验证码 */
export function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
