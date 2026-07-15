<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { switchUser } from '@/services/storage'

// 激活主题（模块级单例，与 PC 端共享持久化）
useTheme()

const router = useRouter()
const auth = useAuthStore()
const taskStore = useTaskStore()

async function bootstrapData() {
  if (!auth.isAuthenticated || !auth.userId) return
  switchUser(auth.userId)
  await taskStore.load().catch((e) => console.error('[mobile] task load failed', e))
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.init()
  }
  await bootstrapData()
})

// 登录状态变化时（登录成功 / 退出）同步数据
watch(
  () => auth.userId,
  async (uid, prev) => {
    if (uid && uid !== prev) {
      await bootstrapData()
    }
    if (!uid && prev) {
      // 退出登录 → 回登录页
      router.replace({ name: 'm-login' })
    }
  }
)
</script>

<template>
  <router-view />
</template>
