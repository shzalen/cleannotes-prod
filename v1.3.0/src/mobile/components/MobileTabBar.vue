<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => (route.meta.tab as string) || '')

const tabs = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'apps', label: '应用', icon: 'apps' },
  { key: 'profile', label: '我的', icon: 'profile' },
] as const

function go(tab: string) {
  router.push({ name: tab })
}
</script>

<template>
  <nav class="tab-bar safe-bottom">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: activeTab === tab.key }"
      @click="go(tab.key)"
    >
      <!-- Home -->
      <svg v-if="tab.icon === 'home'" class="tab-icon" viewBox="0 0 24 24" fill="none">
        <path
          v-if="activeTab === tab.key"
          d="M12 3L4 9V21H10V14H14V21H20V9L12 3Z"
          fill="var(--color-primary)"
        />
        <path
          v-else
          d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
          stroke="var(--color-text-4)"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
      </svg>

      <!-- Apps -->
      <svg v-else-if="tab.icon === 'apps'" class="tab-icon" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
        />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
        />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
        />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
        />
      </svg>

      <!-- Profile -->
      <svg v-else class="tab-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4.5"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
        />
        <path
          d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21"
          :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
          :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>

      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  height: 56px;
  background: var(--color-navbar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--color-separator);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 6px 0;
  transition: opacity 0.15s;
  position: relative;
}

.tab-item:active {
  opacity: 0.6;
}

.tab-icon {
  width: 26px;
  height: 26px;
  transition: transform 0.2s ease;
}

.tab-item.active .tab-icon {
  transform: scale(1.08);
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-4);
  transition: color 0.15s, font-weight 0.15s;
}

.tab-item.active .tab-label {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
