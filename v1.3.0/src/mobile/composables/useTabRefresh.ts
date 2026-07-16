import { ref } from 'vue'

/**
 * 共享的 TabBar 双击刷新触发器
 * TabBar 双击首页/日历时 triggerRefresh()，视图 watch refreshCounter 执行刷新
 */
const refreshCounter = ref(0)

export function useTabRefresh() {
  function triggerRefresh() {
    refreshCounter.value++
  }
  return { refreshCounter, triggerRefresh }
}
