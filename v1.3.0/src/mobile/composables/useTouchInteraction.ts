import { ref, onUnmounted } from 'vue'

interface TouchInteractionOptions<T = unknown> {
  /** tap 回调（短按） */
  onTap: (data: T) => void
  /** 长按回调 */
  onLongPress: (data: T) => void
  /** 长按触发时长（毫秒），默认 800 */
  longPressMs?: number
  /** 进度条延迟显示（毫秒），短按在此时间内松手则不显示进度条，默认 150 */
  progressDelay?: number
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
  const { onTap, onLongPress, longPressMs = 800, progressDelay = 150, moveThreshold = 15 } = options

  // ── 内部状态 ──
  let startX = 0
  let startY = 0
  let hasMoved = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let progressTimer: ReturnType<typeof setTimeout> | null = null
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
    if (progressTimer) {
      clearTimeout(progressTimer)
      progressTimer = null
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

    // 延迟 progressDelay 后再启动进度条动画（短按不会触发）
    const startTime = performance.now()
    progressTimer = setTimeout(() => {
      if (!hasMoved && currentData !== null) {
        pressingTask.value = data
        progressPercent.value = ((performance.now() - startTime) / longPressMs) * 100
        function tick() {
          if (!pressingTask.value) return
          const elapsed = performance.now() - startTime
          progressPercent.value = Math.min(100, (elapsed / longPressMs) * 100)
          if (progressPercent.value < 100) {
            animFrame = requestAnimationFrame(tick)
          }
        }
        animFrame = requestAnimationFrame(tick)
      }
      progressTimer = null
    }, progressDelay)

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
