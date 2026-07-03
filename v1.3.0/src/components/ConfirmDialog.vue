<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { isDark, isZuru, isTencent } = useTheme()

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}>(), {
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  type: 'warning',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('cancel')
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})

const iconColor = computed(() => ({
  danger: isDark.value ? '#f87171' : isZuru.value ? '#CB312D' : isTencent.value ? '#f87171' : '#ef4444',
  warning: isDark.value ? '#fbbf24' : isZuru.value ? '#CB312D' : isTencent.value ? '#fbbf24' : '#f59e0b',
  info: isDark.value ? '#60a5fa' : isZuru.value ? '#999999' : isTencent.value ? '#0052D9' : '#3b82f6',
}))

const btnClass = {
  danger: 'btn-danger',
  warning: 'btn-warning',
  info: 'btn-info',
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" @click="emit('cancel')">
      <div class="confirm-dialog" @click.stop>
        <div class="confirm-icon">
          <svg v-if="type === 'danger'" width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="iconColor[type]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <svg v-else-if="type === 'warning'" width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="iconColor[type]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="iconColor[type]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <h4 class="confirm-title">{{ title }}</h4>
        <p class="confirm-msg" v-html="message"></p>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="emit('cancel')">{{ cancelText }}</button>
          <button :class="['btn-confirm', btnClass[type]]" @click="emit('confirm')">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay-md);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  width: 380px;
  max-width: 90vw;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 28px 24px 20px;
  box-shadow: 0 20px 60px var(--color-shadow-md);
  text-align: center;
  animation: dialogIn 0.2s ease-out;
}

@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.confirm-icon {
  margin-bottom: 12px;
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 8px;
}

.confirm-msg {
  font-size: 13px;
  color: var(--color-text-2);
  margin: 0 0 20px;
  line-height: 1.6;
}

.confirm-msg :deep(strong) {
  color: var(--color-text-1);
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-cancel {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--color-bg-3);
  border-color: var(--color-text-4);
}

.btn-confirm {
  padding: 8px 20px;
  border: none;
  color: var(--color-white);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger { background: var(--color-danger); }
.btn-danger:hover { background: var(--color-danger-text); }
.btn-warning { background: var(--color-warning); }
.btn-warning:hover { background: var(--color-warning-text); }
.btn-info { background: var(--color-info); }
.btn-info:hover { background: var(--color-info-text); }
</style>
