<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => (route.meta.tab as string) || '')

const tabs = [
  { key: 'home', label: '首页' },
  { key: 'calendar', label: '日历' },
  { key: 'profile', label: '我的' },
] as const

function go(tab: string) {
  router.push({ name: tab })
}
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: activeTab === tab.key }"
      @click="go(tab.key)"
    >
      <!-- Home icon -->
      <svg v-if="tab.key === 'home'" class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3L4 9V21H10V14H14V21H20V9L12 3Z" />
      </svg>

      <!-- Calendar icon -->
      <svg v-else-if="tab.key === 'calendar'" class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M3 10H21" stroke="currentColor" stroke-width="1.8" />
        <path d="M8 2V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <path d="M16 2V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>

      <!-- Profile icon -->
      <svg v-else class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" />
      </svg>

      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-navbar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--color-separator);
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 0;
  color: var(--color-text-4);
  transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active {
  opacity: 0.6;
}

.tab-item.active {
  color: var(--color-primary);
}

.tab-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.2s ease;
}

.tab-item.active .tab-icon {
  transform: scale(1.08);
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  transition: font-weight 0.15s;
}

.tab-item.active .tab-label {
  font-weight: 600;
}
</style>
