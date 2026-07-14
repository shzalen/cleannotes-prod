<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()

const appName = computed(() => {
  const name = route.params.name as string
  const labels: Record<string, string> = {
    notes: '笔记',
    ai: 'AI助手',
    weekly: '周报',
    growth: '成长',
    theme: '主题',
    calendar: '日历',
    files: '文件',
    settings: '设置',
    help: '帮助',
    feedback: '反馈',
    more: '更多',
  }
  return labels[name] || '应用'
})

function goBack() {
  router.back()
}
</script>

<template>
  <div class="placeholder-app">
    <header class="nav-bar safe-top">
      <button class="nav-back" @click="goBack">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M15 6L9 12L15 18" stroke="var(--color-text-1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="nav-title">{{ appName }}</h1>
      <div class="nav-spacer" />
    </header>

    <div class="placeholder-content">
      <div class="placeholder-icon">
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <rect x="10" y="6" width="28" height="36" rx="4" stroke="var(--color-text-4)" stroke-width="2"/>
          <path d="M18 18H30M18 24H30M18 30H26" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="placeholder-text">{{ appName }}功能开发中</p>
      <p class="placeholder-hint">敬请期待</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder-app {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  display: flex;
  flex-direction: column;
}

.nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-border);
}

.nav-back {
  border: none;
  background: none;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back:active {
  opacity: 0.5;
}

.nav-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  text-align: center;
}

.nav-spacer {
  width: 36px;
}

.placeholder-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.placeholder-icon {
  opacity: 0.4;
}

.placeholder-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-2);
  margin: 0;
}

.placeholder-hint {
  font-size: 13px;
  color: var(--color-text-4);
  margin: 0;
}
</style>
