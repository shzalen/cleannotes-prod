/**
 * SW Buster —— 在所有应用资源加载之前执行，强制清理旧 Service Worker。
 *
 * 背景：旧版 SW（r48）使用 stale-while-revalidate，静态资源缓存优先，
 * 导致新 CSS/JS 即使已部署也无法被加载（旧 SW 先返回缓存里的旧版本）。
 * 这是典型的“SW 永久锁定”问题：修复 SW 的新代码本身也被旧 SW 挡住。
 *
 * 破局原理：
 *   1. 本文件作为新文件名（旧 SW 缓存里没有），即使旧 SW 的 fetch 拦截，
 *      caches.match 命中失败 → fallback 到网络获取最新版本。
 *   2. 在 <head> 最前面同步执行，第一时间注销所有旧 SW 并清空所有缓存。
 *   3. 清理后带时间戳重新加载页面，确保后续资源都从网络获取最新版本。
 *
 * 一次执行后，新 SW（r49+）会接管，以后无需再运行本脚本。
 */
(async function swBuster() {
  try {
    const url = new URL(window.location.href)

    // 若本次已是清理后的重载，则不再重复清理，避免无限循环。
    // 如果此时看到的仍是旧版本，说明用户环境（如 PWA webclip）清理不掉，
    // 用户需要手动删除并重新添加桌面图标，或到系统设置清除网站数据。
    if (url.searchParams.get('__busted__') === '1') return

    let needReload = false

    // 1. 注销所有旧 Service Worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      if (regs.length > 0) {
        console.log('[sw-buster] 发现 ' + regs.length + ' 个 SW，正在注销')
        await Promise.all(regs.map((r) => r.unregister()))
        needReload = true
      }
    }

    // 2. 清空所有 Cache Storage（旧 CSS/JS 缓存的来源）
    if ('caches' in window) {
      const names = await caches.keys()
      if (names.length > 0) {
        console.log('[sw-buster] 清理缓存：' + names.join(', '))
        await Promise.all(names.map((n) => caches.delete(n)))
        needReload = true
      }
    }

    if (needReload) {
      // 带时间戳硬刷新，并标记 __busted__=1，防止再次触发清理循环
      url.searchParams.set('_t', Date.now().toString())
      url.searchParams.set('__busted__', '1')
      window.location.replace(url.toString())
      return
    }
  } catch (e) {
    console.warn('[sw-buster] 执行异常:', e)
  }
})()
