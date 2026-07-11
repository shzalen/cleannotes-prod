/**
 * Client-side AES-GCM encryption for sensitive data (S-05).
 *
 * Uses Web Crypto API to encrypt/decrypt API keys before storing in the database.
 * The encryption key is derived from the user's Supabase user ID + a static app secret
 * via PBKDF2 (100K iterations). This protects against database-only leaks:
 * an attacker with just the DB cannot decrypt keys without also having the client code.
 */

const APP_SECRET = 'cleannotes-v1-aes-gcm-2026'

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId + APP_SECRET),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(APP_SECRET),
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
 * If encryption fails, returns the original plaintext (graceful degradation).
 */
export async function encryptString(plain: string, userId: string): Promise<string> {
  if (!plain || !userId) return plain
  if (!crypto?.subtle) return plain // Web Crypto not available
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
  } catch {
    return plain
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
