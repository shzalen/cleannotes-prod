<script setup lang="ts">
import MobileTabBar from '@/mobile/components/MobileTabBar.vue'
</script>

<template>
  <div class="mobile-layout">
    <div class="mobile-content">
      <router-view />
    </div>
    <MobileTabBar />
  </div>
</template>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-0);
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
</style>
