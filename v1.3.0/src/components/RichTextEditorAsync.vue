<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const RichTextEditor = defineAsyncComponent(() => import('./RichTextEditor.vue'))

defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  'mention-click': [memoId: string]
  'headings-change': [headings: { level: number; text: string; index: number }[]]
  'image-lightbox': [src: string]
}>()
</script>

<template>
  <Suspense>
    <template #default>
      <RichTextEditor
        :modelValue="modelValue"
        :placeholder="placeholder"
        @update:modelValue="$emit('update:modelValue', $event)"
        @mention-click="$emit('mention-click', $event)"
        @headings-change="$emit('headings-change', $event)"
        @image-lightbox="$emit('image-lightbox', $event)"
      />
    </template>
    <template #fallback>
      <div class="rte-loader">
        <span class="rte-spinner" />
        <span>加载编辑器中…</span>
      </div>
    </template>
  </Suspense>
</template>

<style scoped>
.rte-loader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: var(--color-text-3);
  font-size: 13px;
  min-height: 200px;
}

.rte-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: rte-spin 0.7s linear infinite;
}

@keyframes rte-spin {
  to { transform: rotate(360deg); }
}
</style>
