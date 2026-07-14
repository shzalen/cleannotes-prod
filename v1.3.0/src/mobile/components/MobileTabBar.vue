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
      <!-- Home: house shape via CSS -->
      <span v-if="tab.key === 'home'" class="tb-icon tb-home" :class="{ active: activeTab === tab.key }" />
      <!-- Calendar: calendar shape via CSS -->
      <span v-else-if="tab.key === 'calendar'" class="tb-icon tb-calendar" :class="{ active: activeTab === tab.key }" />
      <!-- Profile: person shape via CSS -->
      <span v-else class="tb-icon tb-profile" :class="{ active: activeTab === tab.key }" />

      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-navbar-bg, rgba(255,255,255,0.9));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--color-separator, rgba(0,0,0,0.08));
  flex-shrink: 0;
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
  padding: 2px 0;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active { opacity: 0.5; }

/* ── CSS Icons ── */
.tb-icon {
  display: block;
  width: 22px;
  height: 22px;
  position: relative;
  transition: transform 0.15s;
}

.tab-item.active .tb-icon { transform: scale(1.1); }

/* Home icon: roof + body */
.tb-home::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-bottom: 7px solid #9CA3AF;
}
.tb-home::after {
  content: '';
  position: absolute;
  bottom: 0; left: 50%; transform: translateX(-50%);
  width: 16px; height: 12px;
  background: #9CA3AF;
  border-radius: 1px 1px 2px 2px;
}
.tb-home.active::before { border-bottom-color: #0052D9; }
.tb-home.active::after { background: #0052D9; }

/* Calendar icon: rect + top bar + dots */
.tb-calendar::before {
  content: '';
  position: absolute;
  top: 2px; left: 1px; right: 1px; bottom: 0;
  border: 2px solid #9CA3AF;
  border-radius: 3px;
  background: transparent;
}
.tb-calendar::after {
  content: '';
  position: absolute;
  top: 2px; left: 1px; right: 1px;
  height: 5px;
  background: #9CA3AF;
  border-radius: 3px 3px 0 0;
}
.tb-calendar.active::before { border-color: #0052D9; }
.tb-calendar.active::after { background: #0052D9; }

/* Profile icon: circle + arc */
.tb-profile::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 9px; height: 9px;
  border: 2px solid #9CA3AF;
  border-radius: 50%;
  background: transparent;
}
.tb-profile::after {
  content: '';
  position: absolute;
  bottom: 0; left: 50%; transform: translateX(-50%);
  width: 16px; height: 8px;
  border: 2px solid #9CA3AF;
  border-radius: 8px 8px 0 0;
  border-bottom: none;
  background: transparent;
}
.tb-profile.active::before { border-color: #0052D9; background: #0052D9; }
.tb-profile.active::after { border-color: #0052D9; }

/* ── Label ── */
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
