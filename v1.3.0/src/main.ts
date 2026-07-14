import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { isMobileDevice, isForcePC } from './utils/device'

// R5-P04: Global error handlers — catch uncaught errors and promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
  // Prevent the browser's default unhandled rejection logging
  event.preventDefault()
})

window.addEventListener('error', (event) => {
  console.error('[error]', event.message, event.filename, event.lineno)
  // Prevent default browser error handling
  event.preventDefault()
})

// ── 移动端自动重定向 ──
// 在 PC 应用挂载前检测：移动设备且未强制桌面版 → 跳转 mobile.html
if (isMobileDevice() && !isForcePC()) {
  window.location.replace('./mobile.html')
} else {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}
