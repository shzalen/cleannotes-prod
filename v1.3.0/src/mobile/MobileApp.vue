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

async function bootstrapData() {
  if (!auth.isAuthenticated || !auth.userId) return
  switchUser(auth.userId)
  await taskStore.load().catch((e) => console.error('[mobile] task load failed', e))
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.init()
  }
  await bootstrapData()
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
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <MobileTabBar v-if="showTabBar" />
  </div>
</template>

<style>
/* ── App Shell：Flex 列布局，全屏覆盖 ── */
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

/* 有 TabBar 时：app-shell 用 padding-bottom 延伸背景到安全区底部
   tabbar 在文档流中自然位于底部，两者背景色一致融为一体 */
.app-shell.has-tabbar {
  padding-bottom: 34px;
  box-sizing: content-box;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 路由切换淡入淡出，消除白屏闪烁 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
