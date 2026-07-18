<script setup lang="ts">
/**
 * 移动端全屏子应用容器 — 用于待办/备忘录/周报
 * 类似微信小程序的全屏弹窗体验
 * 右上角胶囊：··· 更多（弹出菜单） + ⊙ 关闭
 */
import { ref, markRaw, type Component } from 'vue'
import { ActionSheet as VanActionSheet, showToast } from 'vant'

defineOptions({ name: 'MobileSubApp' })

const visible = ref(false)
const title = ref('')
const currentComponent = ref<Component | null>(null)
const componentKey = ref(0)

/** 更多操作 ActionSheet */
const showMore = ref(false)
const moreActions = [
  { name: '重新进入小程序' },
  { name: '分享' },
]

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

/** ··· 按钮：弹出操作菜单（微信小程序风格） */
function handleMore() {
  showMore.value = true
}

function onMoreSelect(action: { name: string }) {
  if (action.name === '重新进入小程序') {
    componentKey.value++
    showToast('已重新进入')
  } else if (action.name === '分享') {
    if (navigator.share) {
      navigator.share({ title: title.value, text: `${title.value} - 清记` }).catch(() => {})
    } else {
      showToast('当前浏览器不支持系统分享')
    }
  }
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

            <!-- 微信小程序风格胶囊：··· 更多 + ⊙ 关闭 -->
            <div class="subapp-capsule">
              <button
                class="subapp-capsule__btn"
                aria-label="更多"
                @click="handleMore"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5"  cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              <span class="subapp-capsule__divider" />
              <button
                class="subapp-capsule__btn"
                aria-label="关闭"
                @click="close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="subapp-body">
          <component :is="currentComponent" :key="componentKey" />
        </div>
      </div>
    </div>

    <!-- 更多操作 ActionSheet -->
    <VanActionSheet
      v-model:show="showMore"
      :actions="moreActions"
      cancel-text="取消"
      close-on-click-action
      teleport="body"
      @select="onMoreSelect"
    />
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
  /* 标题居中：胶囊占位右侧，标题在剩余空间居中 */
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 120px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 微信小程序风格胶囊（··· 更多 + ⊙ 关闭） ──
   浅色导航栏 → 黑底白字；深色导航栏 → 白底黑字（自动反色） */
.subapp-capsule {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  height: 34px;
  border-radius: 17px;
  /* 默认浅色导航栏：黑底白字 */
  background: rgba(0, 0, 0, 0.88);
  color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

/* 深色 / 夜间主题：腾讯蓝和 dark 导航栏均基于浅色 surface，默认保持黑底白字；
   若后续 subapp-header 改为深色背景，可给 header 加 .is-dark 类切到白底黑字 */
:global([data-theme="dark"]) .subapp-capsule,
:global([data-theme="tencent"]) .subapp-capsule {
  background: rgba(0, 0, 0, 0.88);
  color: #fff;
}

.subapp-header.is-dark .subapp-capsule {
  background: rgba(255, 255, 255, 0.92);
  color: #1a1a1a;
}

.subapp-capsule__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 34px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: opacity 0.12s;
}
.subapp-capsule__btn:active { opacity: 0.6; }
.subapp-capsule__btn svg { width: 20px; height: 20px; }

.subapp-capsule__divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}
.subapp-header.is-dark .subapp-capsule__divider {
  background: rgba(0, 0, 0, 0.12);
}

.subapp-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
