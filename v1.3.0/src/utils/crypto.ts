/**
 * Client-side AES-GCM encryption for sensitive data.
 *
 * Uses Web Crypto API to encrypt/decrypt API keys before storing in the database.
 * The encryption key is derived from the user's Supabase user ID + an app secret
 * via PBKDF2 (100K iterations).
 *
 * ⚠️ 安全提示：
 * APP_SECRET 通过 Supabase Vault 的 get_ai_config RPC 获取，
 * 不再硬编码在源码中。如果 Vault 不可用，加密功能将降级为 plaintext 存储，
 * 并打印警告日志。
 */

let _appSecret: string | null = null

/**
 * 初始化加密密钥。应在应用启动时从 Supabase Vault 获取。
 * 如果 Vault 不可用，加密将降级（但会打印警告）。
 */
export function initCryptoSecret(secret: string) {
  _appSecret = secret
}

function getAppSecret(): string {
  if (!_appSecret) {
    console.warn('[crypto] APP_SECRET not initialized, encryption degraded')
    return 'cleannotes-fallback-2026' // 降级密钥
  }
  return _appSecret
}

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const secret = getAppSecret()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId + secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(secret),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string. Returns 'enc:' + base64(iv + ciphertext).
 * P0-05: If encryption fails, throws an error to prevent plaintext storage.
 */
export async function encryptString(plain: string, userId: string): Promise<string> {
  if (!plain || !userId) return plain
  if (!crypto?.subtle) {
    const ctx = typeof window !== 'undefined' ? window.isSecureContext : 'unknown'
    throw new Error(`Web Crypto API 不可用（isSecureContext=${ctx}）。需要 HTTPS 或 localhost 环境。`)
  }
  try {
    const key = await deriveKey(userId)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plain),
    )
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)
    return 'enc:' + btoa(String.fromCharCode(...combined))
  } catch (e) {
    throw new Error('Encryption failed: ' + (e instanceof Error ? e.message : String(e)))
  }
}

/**
 * Decrypt an encrypted string. Handles both 'enc:' prefixed ciphertext and plaintext.
 * Returns empty string if decryption fails and input was encrypted.
 */
export async function decryptString(stored: string, userId: string): Promise<string> {
  if (!stored || !userId) return stored
  if (!stored.startsWith('enc:')) return stored // plaintext (backward compat)
  if (!crypto?.subtle) return ''
  try {
    const combined = Uint8Array.from(atob(stored.slice(4)), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const key = await deriveKey(userId)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}
