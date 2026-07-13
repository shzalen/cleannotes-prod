<template>
  <div class="h5-shell">
    <!-- 顶部状态栏占位 -->
    <div class="h5-safe-top"></div>

    <!-- 主内容区 -->
    <main class="h5-main">
      <router-view v-slot="{ Component }">
        <transition name="h5-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 底部 Tab 导航 -->
    <nav class="h5-tabbar" v-if="showTabbar">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="h5-tab-item"
        :class="{ active: isActive(tab) }"
      >
        <div class="h5-tab-icon" v-html="isActive(tab) ? tab.iconActive : tab.icon"></div>
        <span class="h5-tab-label">{{ tab.label }}</span>
      </router-link>
    </nav>

    <!-- P1-05: Unified confirm/alert dialog for H5 views -->
    <ConfirmDialog
      :visible="dialogState.visible"
      :title="dialogState.title"
      :message="dialogState.message"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText || undefined"
      :type="dialogState.type"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useH5Dialog } from '@/composables/useH5Dialog'

const route = useRoute()
const { state: dialogState, onConfirm, onCancel } = useH5Dialog()

const tabs = [
  {
    label: '任务',
    path: '/h5/tasks',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    iconActive: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  },
  {
    label: '待办',
    path: '/h5/todos',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    iconActive: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  },
  {
    label: '设置',
    path: '/h5/settings',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    iconActive: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  },
]

const showTabbar = computed(() => {
  // 只在主 Tab 页面显示底部导航
  return ['/h5/tasks', '/h5/todos', '/h5/settings'].includes(route.path)
})

function isActive(tab: { path: string }): boolean {
  if (tab.path === '/h5/tasks') {
    return route.path.startsWith('/h5/tasks')
  }
  if (tab.path === '/h5/todos') {
    return route.path.startsWith('/h5/todos')
  }
  return route.path === tab.path
}
</script>

<style scoped>
.h5-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  position: relative;
}

.h5-safe-top {
  height: env(safe-area-inset-top, 0px);
  flex-shrink: 0;
}

.h5-main {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

/* 底部 Tab */
.h5-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  z-index: 100;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.h5-tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-decoration: none;
  color: var(--color-text-4);
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-tab-item.active {
  color: var(--color-primary);
}

.h5-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.h5-tab-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 路由切换动画 */
.h5-fade-enter-active,
.h5-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.h5-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.h5-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
