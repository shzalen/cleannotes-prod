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
      <svg v-if="tab.key === 'home'" class="tab-icon" viewBox="0 0 24 24">
        <path v-if="activeTab === tab.key"
          d="M12 3L4 9V21H10V14H14V21H20V9L12 3Z"
          fill="#0052D9"
        />
        <path v-else
          d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
          fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linejoin="round"
        />
      </svg>

      <!-- Calendar icon -->
      <svg v-else-if="tab.key === 'calendar'" class="tab-icon" viewBox="0 0 24 24">
        <template v-if="activeTab === tab.key">
          <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="#0052D9" stroke-width="1.8"/>
          <path d="M3 10H21" stroke="#0052D9" stroke-width="1.8"/>
          <path d="M8 2V6" stroke="#0052D9" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M16 2V6" stroke="#0052D9" stroke-width="1.8" stroke-linecap="round"/>
        </template>
        <template v-else>
          <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="#9CA3AF" stroke-width="1.8"/>
          <path d="M3 10H21" stroke="#9CA3AF" stroke-width="1.8"/>
          <path d="M8 2V6" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M16 2V6" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round"/>
        </template>
      </svg>

      <!-- Profile icon -->
      <svg v-else class="tab-icon" viewBox="0 0 24 24">
        <template v-if="activeTab === tab.key">
          <circle cx="12" cy="8" r="4" fill="#0052D9"/>
          <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" fill="#0052D9"/>
        </template>
        <template v-else>
          <circle cx="12" cy="8" r="4.5" fill="none" stroke="#9CA3AF" stroke-width="1.8"/>
          <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round"/>
        </template>
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
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active {
  opacity: 0.6;
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
  color: var(--color-text-4);
  transition: color 0.15s, font-weight 0.15s;
}

.tab-item.active .tab-label {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
