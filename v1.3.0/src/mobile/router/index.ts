import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const MobileLayout = () => import('@/mobile/layouts/MobileLayout.vue')
const MobileLogin = () => import('@/mobile/views/MobileLogin.vue')
const MobileHome = () => import('@/mobile/views/MobileHome.vue')
const MobileApps = () => import('@/mobile/views/MobileApps.vue')
const MobileProfile = () => import('@/mobile/views/MobileProfile.vue')
const MobileTaskApp = () => import('@/mobile/views/apps/MobileTaskApp.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: MobileLogin,
  },
  {
    path: '/',
    component: MobileLayout,
    children: [
      { path: '', redirect: '/home' },
      { path: 'home', name: 'home', component: MobileHome, meta: { tab: 'home' } },
      { path: 'apps', name: 'apps', component: MobileApps, meta: { tab: 'apps' } },
      { path: 'profile', name: 'profile', component: MobileProfile, meta: { tab: 'profile' } },
    ],
  },
  // Sub-apps: full-screen, no tab bar
  {
    path: '/app/tasks',
    name: 'app-tasks',
    component: MobileTaskApp,
  },
  // Placeholder routes for other sub-apps
  {
    path: '/app/:name',
    name: 'app-placeholder',
    component: () => import('@/mobile/views/apps/MobilePlaceholderApp.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // Wait for session restore on first navigation
  if (!auth.initialized) {
    await auth.init()
  }
  if (!auth.isAuthenticated && to.name !== 'login') {
    return { name: 'login' }
  }
  if (auth.isAuthenticated && to.name === 'login') {
    return { name: 'home' }
  }
})

export default router
