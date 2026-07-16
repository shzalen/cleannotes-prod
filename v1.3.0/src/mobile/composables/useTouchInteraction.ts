import { ref, onUnmounted } from 'vue'

interface TouchInteractionOptions<T = unknown> {
  /** tap 回调（短按） */
  onTap: (data: T) => void
  /** 长按回调 */
  onLongPress: (data: T) => void
  /** 长按触发时长（毫秒），默认 800 */
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
 *
 * 进度条：
 * - 长按期间通过 requestAnimationFrame 驱动 pressingTask / progressPercent
 * - 模板中用 v-if + :style.width 渲染顶部进度条
 */
export function useTouchInteraction<T = unknown>(options: TouchInteractionOptions<T>) {
  const { onTap, onLongPress, longPressMs = 800, moveThreshold = 15 } = options

  // ── 内部状态 ──
  let startX = 0
  let startY = 0
  let hasMoved = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let animFrame: number | null = null
  let currentData: T | null = null

  // ── 暴露给模板的进度状态 ──
  const pressingTask = ref<T | null>(null)
  const progressPercent = ref(0)

  function resetProgress() {
    if (animFrame) {
      cancelAnimationFrame(animFrame)
      animFrame = null
    }
    pressingTask.value = null
    progressPercent.value = 0
  }

  function cleanup() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    resetProgress()
  }

  function handleTouchStart(data: T, e?: TouchEvent) {
    const touch = e?.touches?.[0]
    if (touch) {
      startX = touch.clientX
      startY = touch.clientY
    }
    hasMoved = false
    currentData = data

    // 启动进度条动画
    pressingTask.value = data
    progressPercent.value = 0

    const startTime = performance.now()
    function tick() {
      if (!pressingTask.value) return // 已被清理
      const elapsed = performance.now() - startTime
      progressPercent.value = Math.min(100, (elapsed / longPressMs) * 100)
      if (progressPercent.value < 100) {
        animFrame = requestAnimationFrame(tick)
      }
    }
    animFrame = requestAnimationFrame(tick)

    timer = setTimeout(() => {
      if (!hasMoved && currentData !== null) {
        resetProgress()
        if (navigator.vibrate) {
          navigator.vibrate(15)
        }
        onLongPress(currentData)
      }
      timer = null
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

  return { handleTouchStart, handleTouchMove, handleTouchEnd, pressingTask, progressPercent }
}
