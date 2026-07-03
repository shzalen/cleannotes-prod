import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'

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
      meta: { public: true },
    },
  ],
})

// Navigation guard: check auth
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  // Public routes don't need auth
  if (to.meta.public) {
    // If already authenticated, redirect to home (except for diag)
    if (auth.isAuthenticated && to.name !== 'diag') {
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

  // Ensure storage adapter has correct userId
  if (auth.userId) {
    switchUser(auth.userId)
  }

  next()
})

export default router
