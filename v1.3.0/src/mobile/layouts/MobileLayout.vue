<script setup lang="ts">
import MobileTabBar from '@/mobile/components/MobileTabBar.vue'
</script>

<template>
  <div class="mobile-layout">
    <router-view />
    <MobileTabBar />
  </div>
</template>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--van-background);
  overflow: hidden;
}
</style>
