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
    // 标记本次已执行，避免与 reload 后的页面重复触发（双保险）
    if (sessionStorage.getItem('__sw_busted__')) return

    let needReload = false

    // 1. 注销所有旧 Service Worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      if (regs.length > 0) {
        console.log('[sw-buster] 发现 ' + regs.length + ' 个旧 SW，正在注销')
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
      sessionStorage.setItem('__sw_busted__', '1')
      // 带时间戳硬刷新，确保所有资源重新从网络获取
      const url = new URL(window.location.href)
      url.searchParams.set('_t', Date.now().toString())
      window.location.replace(url.toString())
      return
    }

    // 3. 即使没有旧 SW，也注册新 SW（r49）以便后续 PWA 正常工作
    //    留给 mobile.ts 里的注册逻辑处理，这里不重复
  } catch (e) {
    console.warn('[sw-buster] 执行异常:', e)
  }
})()
