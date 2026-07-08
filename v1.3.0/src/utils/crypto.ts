/**
 * 密码哈希工具（零依赖，基于浏览器原生 Web Crypto API）
 *
 * 设计原则：
 * - 密码明文永不离开客户端；仅服务端存储派生哈希，无法直接还原明文。
 * - 使用 PBKDF2-HMAC-SHA256 + 每用户随机盐（16 字节），迭代 210,000 次（OWASP 推荐值）。
 * - 校验采用恒定时间比较，降低时序侧信道风险。
 * - 需要安全上下文（https / localhost / Tauri webview）才能使用 crypto.subtle。
 */

const PBKDF2_ITERATIONS = 210_000
const HASH_ALGO = 'SHA-256'
const SALT_BYTES = 16
const DERIVED_BITS = 256 // 32 字节哈希输出

/** ArrayBuffer → base64（用于在网络/存储中安全表示二进制） */
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** base64 → Uint8Array（用于把存储的盐还原为密钥派生输入） */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** 生成随机盐（base64 编码，16 字节） */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return bufToBase64(salt.buffer)
}

/**
 * 由明文密码 + 盐派生哈希（base64 编码的 32 字节）。
 * 相同密码 + 相同盐总是产生相同哈希，便于后续校验。
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    DERIVED_BITS,
  )
  return bufToBase64(bits)
}

/**
 * 校验明文密码是否匹配存储的哈希。
 * 采用恒定时间比较（恒定时间仅对哈希长度一致时成立），防止时序侧信道。
 */
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const computed = await hashPassword(password, salt)
  if (computed.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  }
  return diff === 0
}
