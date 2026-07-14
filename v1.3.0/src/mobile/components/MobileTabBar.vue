<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => (route.meta.tab as string) || '')

// SVG 图标 data URI - 用 img 标签渲染，PWA 兼容
function icon(name: string, filled: boolean) {
  const color = filled ? '#0052D9' : '#9CA3AF'
  const svgs: Record<string, string> = {
    home_filled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3L4 9V21H10V14H14V21H20V9L12 3Z" fill="${color}"/></svg>`,
    home_outline: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    calendar_filled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V8H3V5Z" fill="${color}"/><path d="M3 9H21V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V9Z" fill="${color}"/><rect x="7" y="1" width="2" height="5" rx="1" fill="${color}"/><rect x="15" y="1" width="2" height="5" rx="1" fill="${color}"/></svg>`,
    calendar_outline: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="${color}" stroke-width="1.8"/><path d="M3 10H21" stroke="${color}" stroke-width="1.8"/><rect x="7" y="1" width="2" height="5" rx="1" fill="${color}"/><rect x="15" y="1" width="2" height="5" rx="1" fill="${color}"/></svg>`,
    profile_filled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="${color}"/><path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" fill="${color}"/></svg>`,
    profile_outline: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="${color}" stroke-width="1.8"/><path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  }
  const key = `${name}_${filled ? 'filled' : 'outline'}`
  const svg = svgs[key] || svgs[`${name}_outline`]
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

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
      <img
        :src="icon(tab.key, activeTab === tab.key)"
        class="tab-icon"
        alt=""
      />
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
  gap: 2px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 0;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active { opacity: 0.5; }

.tab-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.15s;
  display: block;
}

.tab-item.active .tab-icon {
  transform: scale(1.1);
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  color: #9CA3AF;
}

.tab-item.active .tab-label {
  color: #0052D9;
  font-weight: 600;
}
</style>
