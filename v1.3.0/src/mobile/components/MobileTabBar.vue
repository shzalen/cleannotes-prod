<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTabRefresh } from '../composables/useTabRefresh'

const route = useRoute()
const router = useRouter()
const { triggerRefresh } = useTabRefresh()

const active = computed(() => (route.meta.tab as string) || 'home')

const tabs = [
  { key: 'home', label: '首页', name: 'm-home' },
  { key: 'calendar', label: '日历', name: 'm-calendar' },
  { key: 'profile', label: '我的', name: 'm-profile' },
] as const

function go(name: string) {
  if (route.name === name) return
  router.replace({ name })
}

// ── 双击刷新检测（仅首页/日历） ──
const doubleTapTimers: Record<string, ReturnType<typeof setTimeout> | null> = {}
const DOUBLE_TAP_WINDOW = 350 // ms

function handleTabClick(tabKey: string, tabName: string) {
  // 非首页/日历不走双击逻辑
  if (tabKey !== 'home' && tabKey !== 'calendar') {
    go(tabName)
    return
  }

  // 当前已在目标页 → 检测双击
  if (active.value === tabKey) {
    if (doubleTapTimers[tabKey]) {
      // 第二次点击（双击）
      clearTimeout(doubleTapTimers[tabKey])
      doubleTapTimers[tabKey] = null
      triggerRefresh()
    } else {
      // 第一次点击，设定时器
      doubleTapTimers[tabKey] = setTimeout(() => {
        doubleTapTimers[tabKey] = null
      }, DOUBLE_TAP_WINDOW)
    }
    return
  }

  // 切换 Tab
  go(tabName)
}
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tabbar__item"
      :class="{ 'is-active': active === tab.key }"
      @click="handleTabClick(tab.key, tab.name)"
    >
      <span class="tabbar__icon">
        <!-- 首页 -->
        <template v-if="tab.key === 'home'">
          <svg v-if="active === tab.key" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3.1 3 10.2V21h6v-6h6v6h6V10.2L12 3.1Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />
          </svg>
        </template>
        <!-- 日历 -->
        <template v-else-if="tab.key === 'calendar'">
          <svg v-if="active === tab.key" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 2v2H5.5A2.5 2.5 0 0 0 3 6.5V8h18V6.5A2.5 2.5 0 0 0 18.5 4H17V2h-2v2H9V2H7Zm14 8H3v8.5A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5V10Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
            <path d="M3.5 9h17M8 2.5v4M16 2.5v4" stroke-linecap="round" />
          </svg>
        </template>
        <!-- 我的 -->
        <template v-else>
          <svg v-if="active === tab.key" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7v1H4v-1Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" stroke-linecap="round" />
          </svg>
        </template>
      </span>
      <span class="tabbar__label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  flex-shrink: 0;
  z-index: 100;
  display: flex;
  align-items: stretch;
  /* iOS PWA 安全区：用 padding-bottom 延伸背景到 Home Indicator 区域 */
  height: var(--tabbar-height);
  box-sizing: content-box;
  padding-bottom: 34px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  box-shadow: 0 -1px 8px var(--color-shadow);
}

.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  transition: transform 0.12s ease, color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

/* 点击反馈：轻微下压 */
.tabbar__item:active {
  transform: scale(0.9);
}

.tabbar__item.is-active {
  color: var(--color-primary);
}

.tabbar__icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabbar__icon svg {
  width: 24px;
  height: 24px;
}

.tabbar__label {
  font-size: 10px;
  line-height: 1;
  font-weight: 500;
}
</style>
