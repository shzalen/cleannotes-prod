<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => (route.meta.tab as string) || '')

const tabs = [
  { key: 'home', label: '首页', icon: '\u2302' },   // ⌂ House
  { key: 'calendar', label: '日历', icon: '\u229E' }, // ⊞ Squared Plus (grid-like)
  { key: 'profile', label: '我的', icon: '\u263A' }, // ☺ Smiley (person-like)
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
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 0;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active { opacity: 0.5; }

.tab-icon {
  display: block;
  font-size: 22px;
  line-height: 1;
  color: #9CA3AF;
  transition: transform 0.15s, color 0.15s;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}

.tab-item.active .tab-icon {
  color: #0052D9;
  transform: scale(1.15);
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  color: #9CA3AF;
  transition: color 0.15s;
}

.tab-item.active .tab-label {
  color: #0052D9;
  font-weight: 600;
}
</style>
