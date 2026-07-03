<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import type { TodoItem } from '@/types'
import TodoEditModal from '@/components/TodoEditModal.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const todoStore = useTodoStore()

onMounted(() => {
  todoStore.load()
})

const editModalRef = ref<InstanceType<typeof TodoEditModal> | null>(null)
const taskModalRef = ref<InstanceType<typeof TaskEditModal> | null>(null)
const deleteConfirmVisible = ref(false)
const deleteTarget = ref<TodoItem | null>(null)

const todos = computed(() => todoStore.activeTodos)

function openNew() {
  editModalRef.value?.openNew()
}

function openEdit(todo: TodoItem) {
  editModalRef.value?.openEdit(todo)
}

function handleDelete(todo: TodoItem) {
  deleteTarget.value = todo
  deleteConfirmVisible.value = true
}

function confirmDelete() {
  if (!deleteTarget.value) return
  todoStore.removeTodo(deleteTarget.value.id)
  deleteConfirmVisible.value = false
  deleteTarget.value = null
}

function cancelDelete() {
  deleteConfirmVisible.value = false
  deleteTarget.value = null
}

function requestConvert(todo: TodoItem) {
  taskModalRef.value?.openFromTodo(todo, (taskId: string) => {
    todoStore.markConverted(todo.id, taskId)
  })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

const todoStats = computed(() => {
  const list = todoStore.activeTodos
  const total = list.length
  const planned = list.filter(t => t.estimatedStart || t.estimatedEnd).length
  const unarranged = total - planned
  const highPriority = list.filter(t => t.importance >= 4).length
  return { total, planned, unarranged, highPriority }
})
</script>

<template>
  <div class="tasks-view">
    <!-- Page header —— 与工作任务保持一致 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="tasks-title">
          待办事项
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="header-icon">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </h2>
      </div>
      <button class="btn-add-task" @click="openNew">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加
      </button>
    </div>

    <!-- Module description -->
    <p class="page-desc">记录将来要做的事——尚未排期、未转化为正式任务的想法与打算，等时机成熟时可转为任务执行。</p>

    <!-- Compact stat strip -->
    <div class="stat-strip" v-if="todoStats.total > 0">
      <span class="stat-pill stat-total">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        {{ todoStats.total }} 待处理
      </span>
      <span class="stat-pill stat-planned">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {{ todoStats.planned }} 已排期
      </span>
      <span class="stat-pill stat-unarranged" v-if="todoStats.unarranged > 0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ todoStats.unarranged }} 待安排
      </span>
      <span class="stat-pill stat-high" v-if="todoStats.highPriority > 0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        {{ todoStats.highPriority }} 高优先
      </span>
    </div>

    <!-- Todo List -->
    <div v-if="todos.length === 0" class="rp-empty">
      <p class="empty-text">暂无待办事项</p>
      <p class="empty-hint">记录未来想做但还没安排日期的事</p>
    </div>

    <div v-else class="task-list">
      <div
        v-for="todo in todos"
        :key="todo.id"
        class="task-card"
      >
            <div class="tc-top">
              <span class="tc-title" @click.stop="openEdit(todo)">{{ todo.title }}</span>
              <div class="tc-actions">
                <button class="tc-btn tc-btn-convert" @click.stop="requestConvert(todo)" title="转为任务">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </button>
                <button class="tc-btn tc-btn-edit" @click.stop="openEdit(todo)" title="编辑">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="tc-btn tc-btn-delete" @click.stop="handleDelete(todo)" title="删除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
                <button class="tc-btn tc-btn-view" @click.stop="openEdit(todo)" title="查看详情">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="tc-meta">
              <span class="tc-stars" v-if="todo.importance > 0">
                <svg v-for="n in todo.importance" :key="n" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="star-filled">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <svg v-for="n in (5 - todo.importance)" :key="'e'+n" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star-empty">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </span>
              <span v-if="todo.estimatedStart || todo.estimatedEnd" class="tc-date planned">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ formatDate(todo.estimatedStart) || '未定' }} → {{ formatDate(todo.estimatedEnd) || '未定' }}
              </span>
              <span v-else class="tc-date created">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                待安排
              </span>
            </div>
          </div>
        </div>

    <!-- Edit Modal -->
    <TodoEditModal ref="editModalRef" />

    <!-- Task Edit Modal（待办转任务时弹出） -->
    <TaskEditModal ref="taskModalRef" />

    <!-- Delete Confirm -->
    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="删除待办"
      :message="deleteTarget ? `确定要删除「<strong>${deleteTarget.title}</strong>」吗？此操作不可恢复。` : ''"
      confirm-text="删除"
      type="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script lang="ts">
export default { name: 'TodoView' }
</script>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-1);
}

/* ---- Page header（与 TasksView 一致） ---- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 8px;
  flex-shrink: 0;
}

.tasks-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: var(--color-text-3);
}

.btn-add-task {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-success-light);
  background: var(--color-success-lighter);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-success-text);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.btn-add-task:hover {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

/* ---- Layout ---- */
.tasks-view > .task-list,
.tasks-view > .rp-empty {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px 24px;
}

/* ---- Compact stat strip ---- */
.stat-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 24px 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

.stat-pill svg {
  flex-shrink: 0;
}

.stat-total {
  color: var(--color-text-2);
  background: var(--color-bg-4);
}

.stat-planned {
  color: var(--color-info-text);
  background: var(--color-info-light);
}

.stat-unarranged {
  color: var(--color-text-3);
  background: var(--color-bg-4);
  border: 1px solid var(--color-border);
}

.stat-high {
  color: var(--color-warning, #f0a020);
  background: var(--color-warning-light, rgba(240, 160, 32, 0.1));
}

/* ---- Empty state（与 TaskRightPanel 一致） ---- */
.rp-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--color-text-3);
}

.empty-text {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-3);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-4);
}

/* ---- Task list（完全复用 TaskRightPanel 样式） ---- */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card {
  padding: 10px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all 0.15s;
}

.task-card:hover {
  border-color: var(--color-text-4);
  box-shadow: 0 1px 4px var(--color-shadow);
}

.tc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.tc-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  line-height: 1.45;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  transition: color 0.12s;
}

.tc-title:hover {
  color: var(--color-primary);
}

.tc-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.task-card:hover .tc-actions {
  opacity: 1;
}

.tc-btn {
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}

.tc-btn:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.tc-btn-convert:hover {
  background: var(--color-success-lighter);
  color: var(--color-success);
}

.tc-btn-edit:hover {
  background: var(--color-info-light);
  color: var(--color-info);
}

.tc-btn-delete:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.tc-btn-view:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.tc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.tc-date {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 6px;
  line-height: 1.4;
}

.tc-date svg {
  flex-shrink: 0;
}

.tc-date.created {
  color: var(--color-text-4);
  background: var(--color-bg-4);
}

.tc-date.planned {
  color: var(--color-info-text);
  background: var(--color-info-light);
}

/* ---- Module description ---- */
.page-desc {
  margin: 0 24px 8px;
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.6;
}

/* ---- Star rating (in meta row) ---- */
.tc-meta > .tc-stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  margin-right: 6px;
  vertical-align: middle;
}

.star-filled {
  color: var(--color-warning, #f0a020);
}

.star-empty {
  color: var(--color-text-4);
  opacity: 0.4;
}
</style>
