<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAiStore } from '@/stores/ai'
import { useTaskStore } from '@/stores/task'
import AiChat from '@/components/AiChat.vue'

const store = useAiStore()
const route = useRoute()
const taskStore = useTaskStore()

function handleQueryParams() {
  // Clear extra context first
  store.setExtraContext('')

  const taskId = route.query.taskId as string
  if (taskId) {
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (task) {
      const context = `【当前分析任务】
标题：${task.title}
状态：${task.status}，优先级：${task.priority}` +
        (task.dueDate ? `，截止日期：${task.dueDate}` : '') +
        (task.description ? `\n\n描述：${task.description}` : '')
      store.setExtraContext(context)
      const prompt = `请分析这个任务：「${task.title}」\n\n从优先级、截止日期、描述等方面给出建议，并告诉我如何更好地完成它。`
      store.send(prompt)
      return
    }
  }

  const prompt = route.query.prompt as string
  if (prompt) {
    store.send(prompt)
  }
}

onMounted(async () => {
  await Promise.all([store.load(), taskStore.load()])
  handleQueryParams()
})

watch(() => [route.query.taskId, route.query.prompt], () => handleQueryParams())
</script>

<template>
  <div class="ai-view">
    <AiChat />
  </div>
</template>

<style scoped>
.ai-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
