import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'm-login',
      component: () => import('../views/MobileLogin.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/MobileLayout.vue'),
      children: [
        {
          path: '',
          name: 'm-home',
          component: () => import('../views/MobileHome.vue'),
          meta: { tab: 'home' },
        },
        {
          path: 'calendar',
          name: 'm-calendar',
          component: () => import('../views/MobileCalendar.vue'),
          meta: { tab: 'calendar' },
        },
        {
          path: 'profile',
          name: 'm-profile',
          component: () => import('../views/MobileProfile.vue'),
          meta: { tab: 'profile' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 鉴权守卫 — 复用 auth store，纯在线会话恢复
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  // 先确保会话已从 Supabase 恢复（幂等）
  if (!auth.initialized) {
    await auth.init()
  }

  // 公开路由（登录页）
  if (to.meta.public) {
    if (auth.isAuthenticated) {
      next({ name: 'm-home' })
      return
    }
    next()
    return
  }

  // 受保护路由需要登录
  if (!auth.isAuthenticated) {
    next({ name: 'm-login' })
    return
  }

  // 同步 storage adapter 的 userId
  if (auth.userId) {
    switchUser(auth.userId)
  }

  next()
})

export default router
