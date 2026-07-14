<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/task'
import { toLocalDate } from '@/utils/time'
import type { Task } from '@/types'
import { ActionSheet as VanActionSheet, Toast } from 'vant'

const store = useTaskStore()

const visible = ref(false)
const task = ref<Task | null>(null)

const today = toLocalDate()

const actions = computed(() => {
  if (!task.value) return []
  if (task.value.status === 'todo') {
    return [{ name: '开始进行', color: 'var(--color-primary)' }]
  }
  if (task.value.status === 'in_progress') {
    return [{ name: '标记完成', color: 'var(--color-success)' }]
  }
  return []
})

function open(t: Task) {
  if (t.startDate ? t.startDate > today : t.createdAt.slice(0, 10) > today) {
    Toast('未来日期任务不可操作')
    return
  }
  task.value = t
  visible.value = true
}

function onSelect(action: { name: string }) {
  if (!task.value) return
  if (action.name === '开始进行') {
    store.updateTask(task.value.id, { status: 'in_progress' })
    Toast.success('已开始')
  } else if (action.name === '标记完成') {
    store.updateTask(task.value.id, { status: 'done' })
    Toast.success('已完成')
  }
}

defineExpose({ open })
</script>

<template>
  <VanActionSheet
    v-model:show="visible"
    :actions="actions"
    cancel-text="取消"
    close-on-click-action
    @select="onSelect"
  />
</template>
