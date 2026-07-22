<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const toolItems = [
  { name: 'pdm-rebuild', path: '/tools/pdm-rebuild', label: 'PDM 表重建工具', desc: '上传新旧 PDM 文件，生成 SQL Server 重建脚本' },
]
</script>

<template>
  <div class="tools-layout">
    <!-- Left sub-menu -->
    <aside class="tools-sidebar">
      <div class="tools-sidebar-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span>常用工具</span>
      </div>
      <nav class="tools-nav">
        <button
          v-for="item in toolItems"
          :key="item.name"
          :class="['tools-nav-item', { active: route.path === item.path }]"
          @click="router.push(item.path)"
        >
          <div class="tools-nav-info">
            <div class="tools-nav-label">{{ item.label }}</div>
            <div class="tools-nav-desc">{{ item.desc }}</div>
          </div>
        </button>
      </nav>
    </aside>

    <!-- Right content -->
    <div class="tools-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.tools-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Left sub-menu */
.tools-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}

.tools-sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-bg-4);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.tools-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.tools-nav-item {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.tools-nav-item:hover {
  background: var(--color-bg-4);
}

.tools-nav-item.active {
  background: var(--color-success-light);
}

.tools-nav-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1.3;
  margin-bottom: 3px;
}

.tools-nav-item.active .tools-nav-label {
  color: var(--color-success-text);
}

.tools-nav-desc {
  font-size: 11px;
  color: var(--color-text-3);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Right content */
.tools-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
