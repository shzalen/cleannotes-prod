<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'

defineOptions({ name: 'MobileNetworkError' })

const router = useRouter()
const taskStore = useTaskStore()

const retrying = ref(false)

/** 从 query 参数获取断网前的页面路径，默认回首页 */
const fromPath = ref('/')

onMounted(() => {
  const queryFrom = router.currentRoute.value.query.from
  if (typeof queryFrom === 'string' && queryFrom) {
    fromPath.value = queryFrom
  }
})

/** 点击重试：重新加载数据，成功后返回原页面 */
async function handleRetry() {
  retrying.value = true
  await taskStore.load(true)
  retrying.value = false

  if (!taskStore.loadError) {
    // 网络恢复，返回原页面
    router.replace(fromPath.value)
  }
}
</script>

<template>
  <div class="network-error-page">
    <div class="network-error__content">
      <div class="network-error__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 class="network-error__title">网络连接异常</h1>
      <p class="network-error__hint">数据加载失败，请检查网络后重试</p>
      <button class="network-error__btn" :disabled="retrying" @click="handleRetry">
        <span v-if="retrying" class="network-error__spinner" />
        <span v-else>点击重试</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.network-error-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-1);
  z-index: 100;
  padding: 24px;
}

.network-error__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.network-error__icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
  margin-bottom: 24px;
}

.network-error__icon svg {
  width: 40px;
  height: 40px;
}

.network-error__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
}

.network-error__hint {
  margin: 0 0 32px;
  font-size: 14px;
  color: var(--color-text-3);
  line-height: 1.5;
}

.network-error__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 40px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
  min-width: 140px;
  min-height: 48px;
}

.network-error__btn:active {
  opacity: 0.85;
}

.network-error__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.network-error__spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: net-spin 0.6s linear infinite;
}

@keyframes net-spin {
  to { transform: rotate(360deg); }
}
</style>
