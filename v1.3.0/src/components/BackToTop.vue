<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const THRESHOLD = 300
const visible = ref(false)
let lastScrolledEl: HTMLElement | Window = window

function onScroll(e: Event) {
  const target = e.target as HTMLElement | Document
  const el = target === document ? window : target as HTMLElement
  const top = el === window
    ? (document.documentElement.scrollTop || document.body.scrollTop)
    : (el as HTMLElement).scrollTop

  if (top > THRESHOLD) {
    lastScrolledEl = el
    if (!visible.value) visible.value = true
  } else {
    if (visible.value) visible.value = false
  }
}

function scrollToTop() {
  if (lastScrolledEl === window) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    ;(lastScrolledEl as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  // 捕获阶段：监听所有元素的 scroll 事件
  document.addEventListener('scroll', onScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <Transition name="btt-fade">
    <button
      v-if="visible"
      class="back-to-top"
      @click="scrollToTop"
      title="回到顶部"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  </Transition>
</template>

<script lang="ts">
export default { name: 'BackToTop' }
</script>

<style scoped>
.back-to-top {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 100;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-2);
  box-shadow: 0 2px 8px var(--color-shadow);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-to-top:hover {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px var(--color-shadow);
  transform: translateY(-1px);
}

.back-to-top:active {
  transform: translateY(0);
}

/* Transition */
.btt-fade-enter-active,
.btt-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.btt-fade-enter-from,
.btt-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
