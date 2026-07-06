<template>
  <div class="h5-page">
    <!-- 顶部头部 -->
    <header class="h5-header">
      <div class="h5-header-bg"></div>
      <div class="h5-header-content">
        <h1 class="h5-title">待办</h1>
        <div class="h5-header-stats">
          <div class="h5-stat">
            <span class="h5-stat-num">{{ activeTodos.length }}</span>
            <span class="h5-stat-label">待处理</span>
          </div>
          <div class="h5-stat-divider"></div>
          <div class="h5-stat">
            <span class="h5-stat-num">{{ convertedCount }}</span>
            <span class="h5-stat-label">已转任务</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 待办列表 -->
    <div class="h5-list" v-if="activeTodos.length > 0">
      <div
        v-for="todo in activeTodos"
        :key="todo.id"
        class="h5-todo-card"
      >
        <!-- 重要度指示器 -->
        <div class="h5-todo-importance" :class="`imp-${todo.importance}`">
          <div v-for="i in 5" :key="i" class="h5-imp-dot" :class="{ filled: i <= todo.importance }"></div>
        </div>

        <!-- 待办内容 -->
        <div class="h5-todo-body" @click="goEdit(todo.id)">
          <div class="h5-todo-title">{{ todo.title }}</div>
          <div class="h5-todo-meta" v-if="todo.estimatedStart || todo.estimatedEnd">
            <span v-if="todo.estimatedStart" class="h5-todo-time">
              {{ formatDate(todo.estimatedStart) }}
            </span>
            <span v-if="todo.estimatedStart && todo.estimatedEnd" class="h5-todo-arrow-text">→</span>
            <span v-if="todo.estimatedEnd" class="h5-todo-time">
              {{ formatDate(todo.estimatedEnd) }}
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="h5-todo-actions">
          <button class="h5-todo-convert" @click="onConvert(todo)" :disabled="converting">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>转任务</span>
          </button>
          <button class="h5-todo-delete" @click="onDelete(todo)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="h5-empty" v-else-if="!loading">
      <div class="h5-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <p class="h5-empty-text">暂无待办事项</p>
    </div>

    <!-- 加载中 -->
    <div class="h5-loading" v-if="loading">
      <div class="h5-spinner"></div>
    </div>

    <!-- 浮动新建按钮 -->
    <button class="h5-fab" @click="goNew" aria-label="新建待办">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import type { TodoItem } from '@/types'
import { useH5Data } from '@/composables/useH5Data'

const router = useRouter()
const { loading, fetchTodos, removeTodo, convertTodoToTask } = useH5Data()

const todos = ref<TodoItem[]>([])
const converting = ref(false)

const activeTodos = computed(() =>
  todos.value
    .filter(t => !t.linkedTaskId)
    .sort((a, b) => b.importance - a.importance)
)

const convertedCount = computed(() => todos.value.filter(t => t.linkedTaskId).length)

function formatDate(d: string): string {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

async function loadData() {
  todos.value = await fetchTodos()
}

async function onConvert(todo: TodoItem) {
  if (converting.value) return
  if (!confirm(`将「${todo.title}」转为任务？`)) return

  converting.value = true
  try {
    await convertTodoToTask(todo)
    // 从列表中移除
    todos.value = todos.value.filter(t => t.id !== todo.id)
  } catch (e) {
    console.error('convert failed', e)
    alert('转换失败，请重试')
  } finally {
    converting.value = false
  }
}

async function onDelete(todo: TodoItem) {
  if (!confirm(`确定删除「${todo.title}」？`)) return

  try {
    await removeTodo(todo.id)
    todos.value = todos.value.filter(t => t.id !== todo.id)
  } catch (e) {
    console.error('delete failed', e)
    alert('删除失败，请重试')
  }
}

function goNew() {
  router.push('/h5/todos/new')
}

function goEdit(id: string) {
  router.push(`/h5/todos/${id}`)
}

onMounted(loadData)
onActivated(loadData)
</script>

<style scoped>
.h5-page {
  min-height: 100%;
}

/* 顶部头部 */
.h5-header {
  position: relative;
  padding: 12px 20px 16px;
  overflow: hidden;
}

.h5-header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 60%, var(--color-primary)) 100%);
  opacity: 0.08;
}

.h5-header-content {
  position: relative;
  z-index: 1;
}

.h5-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.h5-header-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 12px 16px;
  box-shadow: 0 2px 12px var(--color-shadow);
}

.h5-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.h5-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
}

.h5-stat-label {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.h5-stat-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border);
}

/* 待办卡片 */
.h5-list {
  padding: 4px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.h5-todo-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px var(--color-shadow);
}

/* 重要度 */
.h5-todo-importance {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  width: 12px;
}

.h5-imp-dot {
  width: 8px;
  height: 3px;
  border-radius: 2px;
  background: var(--color-border);
  transition: background 0.2s ease;
}

.h5-imp-dot.filled {
  background: var(--color-warning);
}

.h5-todo-importance.imp-5 .h5-imp-dot.filled { background: var(--color-danger); }
.h5-todo-importance.imp-4 .h5-imp-dot.filled { background: var(--color-warning); }

/* 待办内容 */
.h5-todo-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.h5-todo-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h5-todo-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}

.h5-todo-time {
  font-size: 11px;
  color: var(--color-text-3);
}

.h5-todo-arrow-text {
  font-size: 11px;
  color: var(--color-text-4);
}

/* 操作按钮 */
.h5-todo-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.h5-todo-convert {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.h5-todo-convert:active {
  transform: scale(0.95);
}

.h5-todo-convert:disabled {
  opacity: 0.5;
}

.h5-todo-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-4);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-todo-delete:active {
  transform: scale(0.95);
}

/* 空状态 */
.h5-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--color-text-4);
}

.h5-empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

.h5-empty-text {
  font-size: 14px;
  margin: 0;
}

/* 加载中 */
.h5-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.h5-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: h5-spin 0.7s linear infinite;
}

@keyframes h5-spin {
  to { transform: rotate(360deg); }
}

/* 浮动按钮 */
.h5-fab {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  right: 20px;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-accent) 40%, transparent);
  z-index: 50;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.h5-fab:active {
  transform: scale(0.92);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent);
}
</style>
