<template>
  <div class="h5-page">
    <!-- 顶部导航 -->
    <header class="h5-nav">
      <button class="h5-nav-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="h5-nav-title">{{ isEdit ? '编辑待办' : '新建待办' }}</span>
      <button class="h5-nav-save" @click="onSave" :disabled="saving || !form.title.trim()">
        {{ saving ? '保存中' : '保存' }}
      </button>
    </header>

    <!-- 表单 -->
    <div class="h5-form">
      <!-- 标题 -->
      <div class="h5-form-group">
        <label class="h5-form-label">待办标题</label>
        <input
          v-model="form.title"
          type="text"
          class="h5-form-input"
          placeholder="输入待办标题..."
          maxlength="100"
        />
      </div>

      <!-- 描述 -->
      <div class="h5-form-group">
        <label class="h5-form-label">描述（选填）</label>
        <textarea
          v-model="form.description"
          class="h5-form-textarea"
          placeholder="添加描述..."
          rows="3"
          maxlength="500"
        ></textarea>
      </div>

      <!-- 重要度 -->
      <div class="h5-form-group">
        <label class="h5-form-label">重要程度</label>
        <div class="h5-importance-selector">
          <button
            v-for="i in 5"
            :key="i"
            class="h5-imp-btn"
            :class="{ active: form.importance >= i, [`imp-level-${i}`]: true }"
            @click="form.importance = form.importance === i ? 0 : i"
          >
            {{ i }}
          </button>
        </div>
        <div class="h5-imp-hint">
          <span v-if="form.importance === 0">未评级</span>
          <span v-else-if="form.importance <= 2">一般</span>
          <span v-else-if="form.importance <= 3">重要</span>
          <span v-else>非常重要</span>
        </div>
      </div>

      <!-- 预计开始 -->
      <div class="h5-form-group">
        <label class="h5-form-label">预计开始日期</label>
        <input
          v-model="form.estimatedStart"
          type="date"
          class="h5-form-input"
        />
      </div>

      <!-- 预计结束 -->
      <div class="h5-form-group">
        <label class="h5-form-label">预计结束日期</label>
        <input
          v-model="form.estimatedEnd"
          type="date"
          class="h5-form-input"
        />
      </div>

      <!-- 删除按钮（仅编辑时） -->
      <button
        v-if="isEdit"
        class="h5-delete-btn"
        @click="onDelete"
        :disabled="saving"
      >
        删除待办
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { TodoItem } from '@/types'
import { useH5Data } from '@/composables/useH5Data'

const router = useRouter()
const route = useRoute()
const { loading, fetchTodos, createTodo, removeTodo, convertTodoToTask } = useH5Data()

const isEdit = computed(() => !!route.params.id)
const todo = ref<TodoItem | null>(null)
const saving = ref(false)

const form = reactive({
  title: '',
  description: '',
  importance: 0,
  estimatedStart: '',
  estimatedEnd: '',
})

function goBack() {
  router.back()
}

async function onSave() {
  if (!form.title.trim() || saving.value) return
  saving.value = true

  try {
    if (isEdit.value && todo.value) {
      // 更新待办 - 需要先删除再创建（因为 supabase 没有 update 函数，用 upsert）
      const { supabaseUpsertTodo } = await import('@/services/supabase')
      const updated: TodoItem = {
        ...todo.value,
        title: form.title.trim(),
        description: form.description.trim(),
        importance: form.importance,
        estimatedStart: form.estimatedStart || null,
        estimatedEnd: form.estimatedEnd || null,
        updatedAt: new Date().toISOString(),
      }
      await supabaseUpsertTodo(updated)
    } else {
      await createTodo({
        title: form.title.trim(),
        description: form.description.trim(),
        importance: form.importance,
        estimatedStart: form.estimatedStart || null,
        estimatedEnd: form.estimatedEnd || null,
      })
    }
    router.back()
  } catch (e) {
    console.error('save failed', e)
    saving.value = false
  }
}

async function onDelete() {
  if (!todo.value || saving.value) return
  if (!confirm('确定删除此待办？')) return

  saving.value = true
  try {
    await removeTodo(todo.value.id)
    router.back()
  } catch (e) {
    console.error('delete failed', e)
    saving.value = false
  }
}

async function loadData() {
  if (!isEdit.value) return

  loading.value = true
  const all = await fetchTodos()
  const found = all.find(t => t.id === route.params.id)
  if (found) {
    todo.value = found
    form.title = found.title
    form.description = found.description
    form.importance = found.importance
    form.estimatedStart = found.estimatedStart || ''
    form.estimatedEnd = found.estimatedEnd || ''
  }
}

onMounted(loadData)
</script>

<style scoped>
.h5-page {
  min-height: 100%;
}

/* 顶部导航 */
.h5-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.h5-nav-back {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.h5-nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.h5-nav-save {
  padding: 6px 16px;
  border-radius: 8px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-nav-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 表单 */
.h5-form {
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.h5-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.h5-form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  letter-spacing: 0.3px;
}

.h5-form-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-1);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
  -webkit-appearance: none;
  box-sizing: border-box;
}

.h5-form-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 10%, transparent);
}

.h5-form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-1);
  font-size: 15px;
  outline: none;
  resize: none;
  font-family: inherit;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.h5-form-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 10%, transparent);
}

/* 重要度选择器 */
.h5-importance-selector {
  display: flex;
  gap: 8px;
}

.h5-imp-btn {
  flex: 1;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-imp-btn.active.imp-level-1 { background: var(--color-info-light); border-color: var(--color-info); color: var(--color-info-text); }
.h5-imp-btn.active.imp-level-2 { background: var(--color-info-light); border-color: var(--color-info); color: var(--color-info-text); }
.h5-imp-btn.active.imp-level-3 { background: var(--color-warning-light); border-color: var(--color-warning); color: var(--color-warning-text); }
.h5-imp-btn.active.imp-level-4 { background: var(--color-warning-light); border-color: var(--color-warning); color: var(--color-warning-text); }
.h5-imp-btn.active.imp-level-5 { background: var(--color-danger-light); border-color: var(--color-danger); color: var(--color-danger-text); }

.h5-imp-hint {
  font-size: 12px;
  color: var(--color-text-3);
  text-align: center;
}

/* 删除按钮 */
.h5-delete-btn {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--color-danger);
  border-radius: 10px;
  background: var(--color-danger-light);
  color: var(--color-danger-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-delete-btn:active {
  opacity: 0.7;
}

.h5-delete-btn:disabled {
  opacity: 0.4;
}
</style>
