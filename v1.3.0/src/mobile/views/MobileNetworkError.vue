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
      <!-- WiFi 断开图标 -->
      <div class="network-error__icon">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- 外层信号弧 -->
          <path d="M8 24 Q32 4 56 24" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity="0.25" />
          <path d="M16 32 Q32 18 48 32" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity="0.4" />
          <path d="M24 40 Q32 32 40 40" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity="0.6" />
          <!-- 底部圆点 -->
          <circle cx="32" cy="48" r="4" fill="currentColor" />
          <!-- 叉号 -->
          <line x1="20" y1="10" x2="44" y2="52" stroke="var(--color-danger)" stroke-width="3" stroke-linecap="round" />
        </svg>
      </div>

      <h1 class="network-error__title">网络开小差了</h1>
      <p class="network-error__hint">请检查网络连接后重试</p>
      <button class="network-error__btn" :disabled="retrying" @click="handleRetry">
        <span v-if="retrying" class="network-error__spinner" />
        <span v-else>重新加载</span>
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
  animation: error-fade-in 0.35s ease-out;
}

@keyframes error-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.network-error__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.network-error__icon {
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-3);
  color: var(--color-text-3);
  margin-bottom: 28px;
}

.network-error__icon svg {
  width: 44px;
  height: 44px;
}

.network-error__title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
}

.network-error__hint {
  margin: 0 0 36px;
  font-size: 14px;
  color: var(--color-text-3);
  line-height: 1.5;
}

.network-error__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 44px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
  min-width: 148px;
  min-height: 48px;
}

.network-error__btn:active {
  opacity: 0.85;
  transform: scale(0.97);
}

.network-error__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
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
