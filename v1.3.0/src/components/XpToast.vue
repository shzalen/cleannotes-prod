<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGrowthStore } from '@/stores/growth'

const growth = useGrowthStore()

const visible = ref(false)
const xp = ref(0)
const sources = ref<string[]>([])
const timeoutId = ref<number | null>(null)

// 监听 toast 事件
watch(() => growth.lastXpToast, (toast) => {
  if (!toast) return
  xp.value = toast.xp
  sources.value = toast.sources
  visible.value = true
  if (timeoutId.value) clearTimeout(timeoutId.value)
  timeoutId.value = window.setTimeout(() => {
    visible.value = false
  }, 3000)
})

const sourceLabels: Record<string, string> = {
  complete: '完成',
  priority: '高优先',
  night: '夜行',
  deadline: '准时',
  streak: '连续',
  achievement: '成就',
}

// 来源对应的颜色变量
const sourceColorVar: Record<string, string> = {
  complete: 'var(--color-success-text)',
  priority: 'var(--color-danger-text)',
  night: 'var(--color-accent-text)',
  deadline: 'var(--color-info-text)',
  streak: 'var(--color-warning-text)',
  achievement: 'var(--color-warning-text)',
}
</script>

<template>
  <Transition name="xp-toast">
    <div v-if="visible" class="xp-toast">
      <div class="xp-toast__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z"/>
        </svg>
      </div>
      <span class="xp-toast__value">+{{ xp }} XP</span>
      <div class="xp-toast__sources">
        <span
          v-for="src in sources"
          :key="src"
          class="xp-toast__source-tag"
          :style="{ '--src-color': sourceColorVar[src] ?? 'var(--color-text-3)' }"
        >{{ sourceLabels[src] ?? src }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.xp-toast {
  position: fixed;
  top: 80px;
  right: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 12px 18px;
  box-shadow: 0 4px 16px var(--color-shadow-md);
  z-index: 1000;
  border: 1px solid var(--color-warning-light);
}

.xp-toast__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-warning-text);
  flex-shrink: 0;
}

.xp-toast__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning-text);
  letter-spacing: -0.02em;
}

.xp-toast__sources {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.xp-toast__source-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--color-bg-3);
  color: var(--src-color);
}

.xp-toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.xp-toast-leave-active {
  transition: all 0.25s ease;
}

.xp-toast-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.9);
}

.xp-toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}
</style>