import { onUnmounted } from 'vue'

interface TouchInteractionOptions<T = unknown> {
  /** tap 回调（短按） */
  onTap: (data: T) => void
  /** 长按回调 */
  onLongPress: (data: T) => void
  /** 长按触发时长（毫秒），默认 1000 */
  longPressMs?: number
  /** 位移阈值（像素），超过此值视为滚动/下拉，取消一切交互，默认 15 */
  moveThreshold?: number
}

/**
 * 统一的移动端触控交互 composable
 *
 * 判定规则：
 * - 手指位移 > moveThreshold → 视为滚动/下拉，不触发任何回调
 * - 位移 ≤ moveThreshold + duration < longPressMs → tap
 * - 位移 ≤ moveThreshold + duration ≥ longPressMs → long-press（带振动反馈）
 */
export function useTouchInteraction<T = unknown>(options: TouchInteractionOptions<T>) {
  const { onTap, onLongPress, longPressMs = 1000, moveThreshold = 15 } = options

  let startX = 0
  let startY = 0
  let hasMoved = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let currentData: T | null = null

  function cleanup() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function handleTouchStart(data: T, e?: TouchEvent) {
    const touch = e?.touches?.[0]
    if (touch) {
      startX = touch.clientX
      startY = touch.clientY
    }
    hasMoved = false
    currentData = data

    timer = setTimeout(() => {
      if (!hasMoved && currentData !== null) {
        if (navigator.vibrate) {
          navigator.vibrate(15)
        }
        onLongPress(currentData)
      }
      cleanup()
    }, longPressMs)
  }

  function handleTouchMove(e?: TouchEvent) {
    const touch = e?.touches?.[0]
    if (!touch) return

    const dx = Math.abs(touch.clientX - startX)
    const dy = Math.abs(touch.clientY - startY)

    if (dx > moveThreshold || dy > moveThreshold) {
      hasMoved = true
      cleanup()
    }
  }

  function handleTouchEnd() {
    if (!hasMoved && timer && currentData !== null) {
      cleanup()
      onTap(currentData)
    } else {
      cleanup()
    }
  }

  onUnmounted(cleanup)

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}
