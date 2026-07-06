/**
 * 设备检测 & 视图模式偏好
 */

/** 检测当前是否为移动设备（UA + 屏幕宽度） */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  // 移动端 UA 关键词（覆盖手机 + 平板 + 微信内置浏览器）
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  // 超窄屏兜底（手机宽度）
  const isPhoneScreen = window.innerWidth <= 480
  return isMobileUA || isPhoneScreen
}

// ── 视图模式偏好（localStorage 持久化） ──

const FORCE_PC_KEY = 'cleannotes_force_pc'

/** 用户手动切换到桌面版后设置，阻止移动端自动跳转 H5 */
export function setForcePC(): void {
  localStorage.setItem(FORCE_PC_KEY, '1')
}

/** 用户进入 H5 页面时清除，恢复自动检测 */
export function clearForcePC(): void {
  localStorage.removeItem(FORCE_PC_KEY)
}

/** 是否已强制桌面版 */
export function isForcePC(): boolean {
  return localStorage.getItem(FORCE_PC_KEY) === '1'
}
