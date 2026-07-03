<script setup lang="ts">
import { ref, onMounted } from 'vue'

const rows = ref<string[]>([])
const raw = ref('')

onMounted(() => {
  const result: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    const v = localStorage.getItem(k) || ''
    result.push(`${k} = ${v.slice(0, 300)}`)
  }
  rows.value = result

  // Also dump raw JSON of backup if present
  const backupKeys = Object.keys(localStorage).filter(k => k.includes('backup') || k.includes('migrat'))
  const rawObj: Record<string, string> = {}
  for (const k of backupKeys) {
    rawObj[k] = localStorage.getItem(k) || ''
  }
  raw.value = JSON.stringify(rawObj, null, 2)
})
</script>

<template>
  <div class="diag-page">
    <h1>localStorage 诊断</h1>
    <p>总键数：{{ rows.length }}</p>

    <h2>备份 & 迁移相关</h2>
    <pre v-if="raw">{{ raw }}</pre>
    <p v-else>未找到 backup 或 migrat 相关键</p>

    <h2>全部键（前 50 条）</h2>
    <pre>{{ rows.slice(0, 50).join('\n') }}</pre>
  </div>
</template>

<style scoped>
.diag-page {
  padding: 24px;
  font-family: monospace;
  font-size: 13px;
  max-width: 900px;
  margin: 0 auto;
}
pre {
  background: var(--color-bg-2, #f5f5f5);
  padding: 12px;
  border-radius: 6px;
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
