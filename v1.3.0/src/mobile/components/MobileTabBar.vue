<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => {
  const tab = route.meta.tab as string
  if (tab === 'home') return 0
  if (tab === 'calendar') return 1
  if (tab === 'profile') return 2
  return 0
})

function onChange(index: number) {
  const names = ['home', 'calendar', 'profile']
  router.push({ name: names[index] })
}
</script>

<template>
  <VanTabbar :model-value="activeTab" @change="onChange" :safe-area-inset-bottom="true">
    <VanTabbarItem icon="home-o">首页</VanTabbarItem>
    <VanTabbarItem icon="calendar-o">日历</VanTabbarItem>
    <VanTabbarItem icon="user-o">我的</VanTabbarItem>
  </VanTabbar>
</template>
