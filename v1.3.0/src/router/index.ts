import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'
import { isMobileDevice, isForcePC, clearForcePC } from '@/utils/device'

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
      path: '/__diag',
      name: 'diag',
      component: () => import('@/views/DiagView.vue'),
    },
    // ==================== H5 移动端 ====================
    {
      path: '/h5',
      component: () => import('@/layouts/H5Layout.vue'),
      children: [
        { path: '', redirect: '/h5/tasks' },
        {
          path: 'tasks',
          name: 'h5-tasks',
          component: () => import('@/views/h5/H5TaskList.vue'),
        },
        {
          path: 'tasks/new',
          name: 'h5-task-new',
          component: () => import('@/views/h5/H5TaskEdit.vue'),
        },
        {
          path: 'tasks/:id',
          name: 'h5-task-edit',
          component: () => import('@/views/h5/H5TaskEdit.vue'),
        },
        {
          path: 'todos',
          name: 'h5-todos',
          component: () => import('@/views/h5/H5TodoList.vue'),
        },
        {
          path: 'todos/new',
          name: 'h5-todo-new',
          component: () => import('@/views/h5/H5TodoEdit.vue'),
        },
        {
          path: 'todos/:id',
          name: 'h5-todo-edit',
          component: () => import('@/views/h5/H5TodoEdit.vue'),
        },
        {
          path: 'settings',
          name: 'h5-settings',
          component: () => import('@/views/h5/H5Settings.vue'),
        },
      ],
    },
  ],
})

// Navigation guard: check auth + device auto-redirect
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  const isH5 = to.path.startsWith('/h5')

  // 用户主动进入 H5 → 清除 force_pc，恢复自动检测
  if (isH5) {
    clearForcePC()
  }

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
      if (isMobileDevice() && !isH5 && !isForcePC()) {
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
    // H5 路由：保存重定向路径，登录后跳回
    if (isH5) {
      sessionStorage.setItem('h5_redirect', to.fullPath)
    }
    next({ name: 'login' })
    return
  }

  // ── 已认证：设备自适应重定向 ──
  // 移动端访问 PC 路由 → 跳转移动端 mobile.html（除非用户已强制桌面版）
  if (isMobileDevice() && !isH5 && !isForcePC()) {
    window.location.replace('./mobile.html')
    return
  }
  // 桌面端访问 H5 路由 → 跳转 PC 首页
  if (!isMobileDevice() && isH5) {
    next({ name: 'home' })
    return
  }

  // Ensure storage adapter has correct userId
  if (auth.userId) {
    switchUser(auth.userId)
  }

  next()
})

export default router
