import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './mobile/router'
import MobileApp from './MobileApp.vue'
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

// ── 桌面端反向重定向 ──
// 桌面设备误访问 mobile.html → 跳回 PC 端 index.html
if (!isMobileDevice()) {
  window.location.replace('./index.html')
} else {
  const app = createApp(MobileApp)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw-mobile.js').catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err)
      })
    })
  }
}
