import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { switchUser } from '@/services/storage'
import MobileLayout from '@/mobile/layouts/MobileLayout.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/mobile/views/MobileLogin.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: MobileLayout,
      children: [
        {
          path: '',
          redirect: { name: 'home' },
        },
        {
          path: 'home',
          name: 'home',
          component: () => import('@/mobile/views/MobileHome.vue'),
          meta: { tab: 'home' },
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('@/mobile/views/MobileCalendar.vue'),
          meta: { tab: 'calendar' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/mobile/views/MobileProfile.vue'),
          meta: { tab: 'profile' },
        },
      ],
    },
  ],
})

let authReady = false

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  if (!authReady) {
    await auth.init()
    authReady = true
  }

  if (to.meta.public) {
    if (auth.isAuthenticated) {
      next({ name: 'home' })
    } else {
      next()
    }
    return
  }

  if (!auth.isAuthenticated) {
    next({ name: 'login' })
    return
  }

  // Set user context for data stores
  if (auth.userId) {
    switchUser(auth.userId)
  }

  next()
})

export default router
