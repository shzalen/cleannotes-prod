<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

interface AppEntry {
  name: string
  label: string
  color: string
  route?: string
  icon: string
}

const appGroups: { title: string; apps: AppEntry[] }[] = [
  {
    title: '常用应用',
    apps: [
      { name: 'tasks', label: '任务', color: '#4F6CF7', route: '/app/tasks', icon: 'check' },
      { name: 'notes', label: '笔记', color: '#34C759', route: '/app/notes', icon: 'note' },
      { name: 'ai', label: 'AI助手', color: '#AF52DE', route: '/app/ai', icon: 'sparkle' },
      { name: 'weekly', label: '周报', color: '#FF9500', route: '/app/weekly', icon: 'chart' },
    ],
  },
  {
    title: '工具',
    apps: [
      { name: 'growth', label: '成长', color: '#FF2D55', route: '/app/growth', icon: 'trend' },
      { name: 'theme', label: '主题', color: '#00C7BE', route: '/app/theme', icon: 'palette' },
      { name: 'calendar', label: '日历', color: '#5856D6', route: '/app/calendar', icon: 'calendar' },
      { name: 'files', label: '文件', color: '#007AFF', route: '/app/files', icon: 'folder' },
    ],
  },
  {
    title: '更多',
    apps: [
      { name: 'settings', label: '设置', color: '#8E8E93', route: '/app/settings', icon: 'gear' },
      { name: 'help', label: '帮助', color: '#30B0C7', route: '/app/help', icon: 'help' },
      { name: 'feedback', label: '反馈', color: '#FF3B30', route: '/app/feedback', icon: 'feedback' },
      { name: 'more', label: '更多', color: '#8E8E93', route: '/app/more', icon: 'dots' },
    ],
  },
]

function openApp(app: AppEntry) {
  if (app.route) {
    router.push(app.route)
  }
}
</script>

<template>
  <div class="apps-page safe-top">
    <header class="page-header">
      <h1 class="page-title">应用</h1>
    </header>

    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none">
        <circle cx="11" cy="11" r="7" stroke="var(--color-text-4)" stroke-width="2"/>
        <path d="M16 16L21 21" stroke="var(--color-text-4)" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input type="text" placeholder="搜索应用" class="search-input" readonly />
    </div>

    <div class="app-groups">
      <div v-for="group in appGroups" :key="group.title" class="app-group">
        <h2 class="group-title">{{ group.title }}</h2>
        <div class="app-grid">
          <button
            v-for="app in group.apps"
            :key="app.name"
            class="app-item"
            @click="openApp(app)"
          >
            <div class="app-icon" :style="{ background: app.color }">
              <!-- Icons rendered via SVG -->
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                <template v-if="app.icon === 'check'">
                  <path d="M5 12L10 17L19 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </template>
                <template v-else-if="app.icon === 'note'">
                  <rect x="6" y="4" width="12" height="16" rx="2" stroke="white" stroke-width="2"/>
                  <path d="M9 10H15M9 14H13" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </template>
                <template v-else-if="app.icon === 'sparkle'">
                  <path d="M12 4L13.5 9.5L19 11L13.5 12.5L12 18L10.5 12.5L5 11L10.5 9.5Z" fill="white"/>
                </template>
                <template v-else-if="app.icon === 'chart'">
                  <rect x="5" y="10" width="3" height="10" rx="0.5" fill="white"/>
                  <rect x="10.5" y="6" width="3" height="14" rx="0.5" fill="white"/>
                  <rect x="16" y="13" width="3" height="7" rx="0.5" fill="white"/>
                </template>
                <template v-else-if="app.icon === 'trend'">
                  <path d="M4 18L10 12L14 16L20 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M15 8H20V13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </template>
                <template v-else-if="app.icon === 'palette'">
                  <circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/>
                  <path d="M12 4A8 8 0 0 1 12 20Z" fill="white"/>
                </template>
                <template v-else-if="app.icon === 'calendar'">
                  <rect x="4" y="6" width="16" height="14" rx="2" stroke="white" stroke-width="2"/>
                  <path d="M4 10H20" stroke="white" stroke-width="2"/>
                  <path d="M8 4V8M16 4V8" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </template>
                <template v-else-if="app.icon === 'folder'">
                  <path d="M4 8C4 6.89543 4.89543 6 6 6H9L11 8H18C19.1046 8 20 8.89543 20 10V16C20 17.1046 19.1046 18 18 18H6C4.89543 18 4 17.1046 4 16V8Z" stroke="white" stroke-width="2"/>
                </template>
                <template v-else-if="app.icon === 'gear'">
                  <circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/>
                  <path d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </template>
                <template v-else-if="app.icon === 'help'">
                  <circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/>
                  <path d="M9.5 9.5C9.5 8.12 10.62 7 12 7C13.38 7 14.5 8.12 14.5 9.5C14.5 12 12 12 12 14" stroke="white" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="12" cy="17" r="1" fill="white"/>
                </template>
                <template v-else-if="app.icon === 'feedback'">
                  <path d="M5 6C5 4.89543 5.89543 4 7 4H17C18.1046 4 19 4.89543 19 6V14C19 15.1046 18.1046 16 17 16H12L8 20V16H7C5.89543 16 5 15.1046 5 14V6Z" stroke="white" stroke-width="2"/>
                </template>
                <template v-else-if="app.icon === 'dots'">
                  <circle cx="7" cy="12" r="1.5" fill="white"/>
                  <circle cx="12" cy="12" r="1.5" fill="white"/>
                  <circle cx="17" cy="12" r="1.5" fill="white"/>
                </template>
              </svg>
            </div>
            <span class="app-label">{{ app.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="sort-hint">
      <span>长按图标可拖拽排序</span>
    </div>
  </div>
</template>

<style scoped>
.apps-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  padding-bottom: 80px;
}

.page-header {
  padding: 16px 20px 16px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0;
  letter-spacing: -0.3px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 20px;
  padding: 0 14px;
  height: 40px;
  background: var(--color-bg-2);
  border-radius: 12px;
}

.search-icon {
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: none;
  outline: none;
  font-size: 15px;
  color: var(--color-text-2);
  width: 100%;
}

.search-input::placeholder {
  color: var(--color-text-4);
}

.app-groups {
  padding: 0 16px;
}

.app-group {
  margin-bottom: 8px;
}

.group-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-3);
  margin: 20px 0 14px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px 0;
}

.app-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border: none;
  background: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.app-item:active {
  opacity: 0.6;
}

.app-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-label {
  font-size: 13px;
  color: var(--color-text-2);
  font-weight: 400;
}

.sort-hint {
  text-align: center;
  padding: 28px 0;
  font-size: 13px;
  color: var(--color-text-4);
}
</style>
