<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { switchUser } from '@/services/storage'
import MobileTabBar from './components/MobileTabBar.vue'

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
  taskStore.load().catch((e) => console.error('[mobile] task load failed', e))
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
  <div class="app-shell" :class="{ 'has-tabbar': showTabBar }">
    <div class="app-content">
      <router-view v-slot="{ Component }">
        <transition name="fade">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <MobileTabBar v-if="showTabBar" />
  </div>
</template>

<style>
/* ── App Shell：全屏覆盖，flex 列布局 ── */
.app-shell {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
