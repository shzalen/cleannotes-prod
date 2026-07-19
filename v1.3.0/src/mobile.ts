import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './mobile/router'
import MobileApp from './mobile/MobileApp.vue'

// Vant 全量注册 — 使用 import * as 方式确保所有导出被引用
import * as Vant from 'vant'
import 'vant/lib/index.css'
import './mobile/style.css'

import { isMobileDevice } from './utils/device'

window.addEventListener('unhandledrejection', (event) => {
  console.error('[mobile:unhandledrejection]', event.reason)
  event.preventDefault()
})

window.addEventListener('error', (event) => {
  console.error('[mobile:error]', event.message, event.filename, event.lineno)
  event.preventDefault()
})

// ── 禁止双击缩放 / 双指缩放手势 ──
// viewport user-scalable=no 在 iOS Safari 10+ 部分场景被忽略，
// 此处通过 gesturestart + dblclick 双重兜底。
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })
document.addEventListener('dblclick', (e) => e.preventDefault())

// ── 初始化主题（默认腾讯蓝）──
// useTheme 的持久化 key 与 PC 端共享（cleannotes_theme），此处仅做首屏兜底，
// 避免 Vue 挂载前的白屏闪烁。真正的响应式切换由 useTheme() 在组件内接管。
;(function initThemeEarly() {
  const stored = localStorage.getItem('cleannotes_theme')
  let theme = 'tencent'
  if (stored === 'dark' || stored === 'zuru' || stored === 'tencent') {
    theme = stored
  } else if (stored === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', theme)
})()

// ── 桌面端反向重定向 ──
if (!isMobileDevice()) {
  window.location.replace('./index.html')
} else {
  const app = createApp(MobileApp)
  app.use(createPinia())
  app.use(router)
  // 全量注册 Vant 组件 — 遍历命名空间所有导出，确保不被 tree-shake
  Object.values(Vant).forEach((mod: any) => {
    if (mod && typeof mod.install === 'function') {
      app.use(mod)
    }
  })
  app.mount('#app')

  // 注册 PWA Service Worker（添加到桌面）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw-mobile.js').then((reg) => {
        // 检测到新 SW 安装完成（updatefound → state 变为 installed）
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // 新 SW 已安装并 skipWaiting 激活，刷新页面让新 SW 接管资源请求
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 新版本已就绪，刷新以加载最新资源')
              window.location.reload()
            }
          })
        })
        // 每 60 分钟主动检查一次更新（默认浏览器可能节流到 24h）
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err)
      })

      // 新 SW 激活并接管控制（controllerchange）时，若尚未刷新则刷新一次
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloaded) {
          reloaded = true
          window.location.reload()
        }
      })
    })
  }
}
