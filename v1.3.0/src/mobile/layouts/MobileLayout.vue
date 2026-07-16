<script setup lang="ts">
</script>

<template>
  <div class="m-layout">
    <div class="m-layout__body">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['MobileHome', 'MobileCalendar', 'MobileProfile']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </div>
</template>

<style scoped>
.m-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--color-bg-1);
}

.m-layout__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
