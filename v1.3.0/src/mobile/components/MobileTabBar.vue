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
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
        <!-- Home icon -->
        <template v-if="tab.icon === 'home'">
          <path
            d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
            :fill="activeTab === tab.key ? 'var(--color-primary)' : 'none'"
            :stroke="activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-4)'"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </template>
        <!-- Apps grid icon -->
        <template v-else-if="tab.icon === 'apps'">
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
        </template>
        <!-- Profile icon -->
        <template v-else>
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
  background: var(--color-surface);
  border-top: 0.5px solid var(--color-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
  padding: 6px 0;
  transition: opacity 0.15s;
}

.tab-item:active {
  opacity: 0.6;
}

.tab-icon {
  width: 24px;
  height: 24px;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-4);
  transition: color 0.15s;
}

.tab-item.active .tab-label {
  color: var(--color-primary);
}
</style>
