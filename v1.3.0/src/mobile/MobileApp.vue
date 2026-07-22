<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { switchUser } from '@/services/storage'
import MobileTabBar from './components/MobileTabBar.vue'
import MobileHolidayCard from './components/MobileHolidayCard.vue'
import { checkAndShowHolidayCard } from './composables/useHolidayGreeting'

// 激活主题（模块级单例，与 PC 端共享持久化）
useTheme()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const taskStore = useTaskStore()

// 仅在有 meta.tab 的页面显示 TabBar（登录页等不显示）
const showTabBar = computed(() => !!route.meta.tab)

function bootstrapData() {
  if (!auth.isAuthenticated || !auth.userId) return
  switchUser(auth.userId)
  // 非阻塞：fire-and-forget，各页面用自己的 loading 状态
  taskStore.load().catch((e) => console.error('[mobile] task load failed', e)).then(() => {
    // 加载失败时跳转到网络错误页面，记录当前路径用于返回
    if (taskStore.loadError) {
      const currentPath = route.fullPath
      router.replace({ path: '/network-error', query: { from: currentPath } })
      return
    }
    // 数据加载完成后检查节日卡片（当天首次打开时弹出）
    // 延迟 600ms 让首页渲染稳定，避免卡片与骨架屏同时出现
    setTimeout(() => {
      checkAndShowHolidayCard()
    }, 600)
  })
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.init()
  }
  // auth.init 完成后，如果未登录则跳转登录页
  if (!auth.isAuthenticated) {
    router.replace({ name: 'm-login' })
    return
  }
  bootstrapData()
})

// 登录状态变化时（登录成功 / 退出）同步数据
watch(
  () => auth.userId,
  async (uid, prev) => {
    if (uid && uid !== prev) {
      await bootstrapData()
    }
    if (!uid && prev) {
      // 退出登录 → 回登录页
      router.replace({ name: 'm-login' })
    }
  }
)
</script>

<template>
  <!-- 品牌加载页 — auth.init() 完成前显示 -->
  <!-- 不依赖路由，auth 初始化完即切换到正常 Shell -->
  <div v-if="!auth.initialized" class="splash-screen">
    <div class="splash-screen__brand">
      <img class="splash-screen__logo" src="/icon-512.png" alt="清记" />
      <p class="splash-screen__subtitle">清简记事，井然有序</p>
      <span class="splash-screen__spinner" />
    </div>
  </div>

  <!-- 正常 App Shell — auth 初始化完成后渲染 -->
  <div v-else class="app-shell" :class="{ 'has-tabbar': showTabBar }">
    <div class="app-content">
      <router-view v-slot="{ Component }">
        <transition name="fade">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <MobileTabBar v-if="showTabBar" />

    <!-- 节日问候卡片（当天首次打开时弹出） -->
    <MobileHolidayCard />
  </div>
</template>

<style>
/* ── 品牌加载页（Splash Screen）— auth.init() 完成前展示 ── */
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-1);
  z-index: 200;
}

.splash-screen__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.splash-screen__logo {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 82, 217, 0.25);
  object-fit: cover;
  -webkit-user-drag: none;
  user-select: none;
}

.splash-screen__subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--color-text-3);
}

.splash-screen__spinner {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: splash-spin 0.8s linear infinite;
}

@keyframes splash-spin {
  to { transform: rotate(360deg); }
}

/* ── App Shell：填充整个 #app 容器 ── */
.app-shell {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.app-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 为 fixed TabBar 留出空间（含安全区） */
  padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px));
}

/* 路由切换淡入淡出（叠加模式，无 out-in 等待） */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
