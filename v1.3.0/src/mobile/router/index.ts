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

// 鉴权守卫 — 纯在线会话恢复
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  // 不阻塞等待 auth.init() — MobileApp.vue 的 onMounted 已负责初始化
  // 守卫只检查当前状态，未初始化时放行由 MobileApp 后续处理

  // 公开路由（登录页）
  if (to.meta.public) {
    if (auth.isAuthenticated) {
      next({ name: 'm-home' })
      return
    }
    next()
    return
  }

  // 受保护路由：auth 未初始化时也放行，MobileApp 会等 init 完成后再决定
  if (auth.initialized && !auth.isAuthenticated) {
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
