import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'
import { isMobileDevice, isForcePC } from '@/utils/device'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('@/views/TasksView.vue'),
    },
    {
      path: '/todos',
      name: 'todos',
      component: () => import('@/views/TodoView.vue'),
    },
    {
      path: '/memos',
      name: 'memos',
      component: () => import('@/views/MemoView.vue'),
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('@/views/AiView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/spirit',
      name: 'spirit',
      component: () => import('@/views/SpiritView.vue'),
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('@/views/ReportsView.vue'),
    },
    {
      path: '/tools',
      component: () => import('@/views/ToolsView.vue'),
      redirect: '/tools/pdm-rebuild',
      children: [
        {
          path: 'pdm-rebuild',
          name: 'pdm-rebuild',
          component: () => import('@/views/tools/PdmRebuildView.vue'),
        },
      ],
    },
    {
      path: '/__diag',
      name: 'diag',
      component: () => import('@/views/DiagView.vue'),
    },
  ],
})

// Navigation guard: check auth + device auto-redirect
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  // 关键修复：在评估受保护路由前，先确保会话已从 Supabase 恢复。
  // 否则刷新瞬间 auth.isAuthenticated 仍为 false，会把已登录用户误判为未登录，
  // 重定向到 login，最终被 App.vue 推回首页，导致刷新后丢失当前页面。
  if (!auth.initialized) {
    await auth.init()
  }

  // Public routes don't need auth
  if (to.meta.public) {
    // If already authenticated, redirect (except for diag)
    if (auth.isAuthenticated && to.name !== 'diag') {
      if (isMobileDevice() && !isForcePC()) {
        window.location.replace('./mobile.html')
        return
      }
      next({ name: 'home' })
      return
    }
    next()
    return
  }

  // Protected routes require auth
  if (!auth.isAuthenticated) {
    next({ name: 'login' })
    return
  }

  // ── 已认证：设备自适应重定向 ──
  // 移动端访问 PC 路由 → 跳转移动端 mobile.html（除非用户已强制桌面版）
  if (isMobileDevice() && !isForcePC()) {
    window.location.replace('./mobile.html')
    return
  }

  // Ensure storage adapter has correct userId
  if (auth.userId) {
    switchUser(auth.userId)
  }

  next()
})

export default router
