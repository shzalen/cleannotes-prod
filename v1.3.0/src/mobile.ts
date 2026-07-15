import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './mobile/router'
import MobileApp from './mobile/MobileApp.vue'

// Vant 全量注册（移动端 bundle 大小可接受，换取开发便利）
import Vant from 'vant'
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
  app.use(Vant)
  app.mount('#app')

  // 注册 PWA Service Worker（添加到桌面）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw-mobile.js').catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err)
      })
    })
  }
}
