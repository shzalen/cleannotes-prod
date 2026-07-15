<script setup lang="ts">
/**
 * 移动端全屏子应用容器 — 用于待办/备忘录/周报
 * 类似微信小程序的全屏弹窗体验
 */
import { ref, computed, markRaw, type Component } from 'vue'

defineOptions({ name: 'MobileSubApp' })

const visible = ref(false)
const title = ref('')
const currentComponent = ref<Component | null>(null)
const componentKey = ref(0)

function open(name: string, comp: Component) {
  title.value = name
  currentComponent.value = markRaw(comp)
  componentKey.value++
  visible.value = true
}

function close() {
  visible.value = false
  currentComponent.value = null
}

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="subapp-overlay">
      <div class="subapp-container">
        <!-- 顶部导航栏 -->
        <div class="subapp-header">
          <div class="subapp-header__safe" />
          <div class="subapp-header__bar">
            <span class="subapp-header__title">{{ title }}</span>
            <button class="subapp-header__close" @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="subapp-body">
          <component :is="currentComponent" :key="componentKey" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.subapp-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--color-bg-1);
  display: flex;
  flex-direction: column;
}

.subapp-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.subapp-header {
  padding-top: var(--safe-top);
  background: var(--color-surface);
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
}

.subapp-header__bar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 16px;
}

.subapp-header__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
}

.subapp-header__close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 4px;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s;
}
.subapp-header__close:active { background: var(--color-bg-3); }
.subapp-header__close svg { width: 18px; height: 18px; }

.subapp-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
