import { ref, watch, type Ref } from 'vue'
import { toLocalDate } from '@/utils/time'

/** localStorage 键名 */
function storageKey(userId: string): string {
  return userId ? `cleannotes_${userId}_last_celebration` : 'cleannotes_last_celebration'
}

/**
 * 检测今日任务是否全部完成，并在首次达成时触发庆祝卡片。
 *
 * @param todayTotal 今日任务总数
 * @param todayDone  今日已完成数
 * @param loaded     store 是否已加载
 * @param userId     当前用户 ID（用于隔离 localStorage）
 */
export function useCompletionCelebration(
  todayTotal: Ref<number>,
  todayDone: Ref<number>,
  loaded: Ref<boolean>,
  userId: Ref<string | undefined>,
) {
  const visible = ref(false)

  /** 今天是否已经展示过庆祝卡片 */
  function hasShownToday(): boolean {
    const key = storageKey(userId.value ?? '')
    const lastShown = localStorage.getItem(key)
    if (!lastShown) return false
    return lastShown === toLocalDate(new Date())
  }

  /** 标记今天已展示 */
  function markShownToday() {
    const key = storageKey(userId.value ?? '')
    localStorage.setItem(key, toLocalDate(new Date()))
  }

  /** 手动打开（调试用） */
  function open() {
    visible.value = true
  }

  /** 关闭 */
  function close() {
    visible.value = false
  }

  // ---- 监听完成状态 ----
  // 用 computed 守卫：只在"全部完成"这个状态首次达成时才进入核心逻辑，
  // 避免每次 task 变更都无谓触发 watch 回调
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch([todayTotal, todayDone, loaded], ([total, done, isLoaded]) => {
    if (!isLoaded || total === 0 || done !== total) return
    if (hasShownToday()) return

    // 防抖：600ms 内状态可能回退（如同步导致短暂波动），避免误触发
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (todayDone.value === todayTotal.value && !hasShownToday()) {
        visible.value = true
        markShownToday()
      }
      debounceTimer = null
    }, 600)
  }, { immediate: true })

  return {
    visible,
    open,
    close,
  }
}
