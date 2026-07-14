<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { useTodoStore } from '@/stores/todo'
import type { Task } from '@/types'
import { toLocalDate } from '@/utils/time'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const todoStore = useTodoStore()

type Tab = 'tasks' | 'todos'
const activeTab = ref<Tab>('tasks')

type Filter = 'all' | 'today' | 'overdue' | 'done'
const activeFilter = ref<Filter>('all')

const today = toLocalDate()

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'overdue', label: '延期' },
  { key: 'done', label: '已完成' },
]

// ---- Task list ----
const filteredTasks = computed(() => {
  let list = taskStore.tasks.slice()
  if (activeFilter.value === 'today') {
    list = list.filter(t => t.startDate === today || (!t.startDate && t.createdAt.startsWith(today)))
  } else if (activeFilter.value === 'overdue') {
    list = list.filter(t => t.startDate && t.startDate < today && t.status !== 'done')
  } else if (activeFilter.value === 'done') {
    list = list.filter(t => t.status === 'done')
  }
  // Sort: incomplete first, then by startDate + startTime
  return list.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    if (a.startDate && b.startDate) {
      const dc = a.startDate.localeCompare(b.startDate)
      if (dc !== 0) return dc
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
    }
    if (a.startDate && !b.startDate) return -1
    if (!a.startDate && b.startDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
})

// Group by date
const groupedTasks = computed(() => {
  const groups: { date: string; label: string; tasks: Task[] }[] = []
  for (const t of filteredTasks.value) {
    const dateKey = t.startDate || t.createdAt.slice(0, 10)
    let group = groups.find(g => g.date === dateKey)
    if (!group) {
      const label = dateKey === today ? '今天' : dateKey < today ? `延期 · ${dateKey.slice(5)}` : dateKey.slice(5)
      group = { date: dateKey, label, tasks: [] }
      groups.push(group)
    }
    group.tasks.push(t)
  }
  return groups
})

// ---- Todo list (active todos = not converted to tasks) ----
const filteredTodos = computed(() => {
  let list = todoStore.activeTodos
  if (activeFilter.value === 'today') {
    list = list.filter(t => t.estimatedStart === today || t.createdAt.startsWith(today))
  }
  return list
})

const importanceLabel: Record<number, string> = { 0: '', 1: '★', 2: '★★', 3: '★★★', 4: '★★★★', 5: '★★★★★' }

// ---- Actions ----
function goBack() {
  router.back()
}

function toggleTaskStatus(task: Task) {
  taskStore.requestToggleStatus(task.id)
}

const showAddSheet = ref(false)

function openAdd() {
  showAddSheet.value = true
}

const newTaskTitle = ref('')
const newTaskDate = ref(today)

function addQuickTask() {
  if (!newTaskTitle.value.trim()) return
  taskStore.addTask({
    title: newTaskTitle.value.trim(),
    startDate: newTaskDate.value || null,
  })
  newTaskTitle.value = ''
  showAddSheet.value = false
}

// Check if opened with a specific task ID (from home page tap)
onMounted(() => {
  const taskId = route.query.id as string
  if (taskId) {
    // Could open detail, for now just clear the query
    router.replace({ name: 'app-tasks' })
  }
})
</script>

<template>
  <div class="task-app">
    <!-- Nav bar -->
    <header class="nav-bar safe-top">
      <button class="nav-back" @click="goBack">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M15 6L9 12L15 18" stroke="var(--color-text-1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="nav-title">任务管理</h1>
      <button class="nav-search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <circle cx="11" cy="11" r="7" stroke="var(--color-text-2)" stroke-width="2"/>
          <path d="M16 16L21 21" stroke="var(--color-text-2)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <!-- Tab toggle -->
    <div class="tab-toggle">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'tasks' }"
        @click="activeTab = 'tasks'"
      >任务</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'todos' }"
        @click="activeTab = 'todos'"
      >待办</button>
    </div>

    <!-- Filter chips -->
    <div class="filter-chips no-scrollbar">
      <button
        v-for="f in filters"
        :key="f.key"
        class="chip"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >{{ f.label }}</button>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Tasks tab -->
      <template v-if="activeTab === 'tasks'">
        <div v-for="group in groupedTasks" :key="group.date" class="task-group">
          <div class="group-header">{{ group.label }}</div>
          <div
            v-for="task in group.tasks"
            :key="task.id"
            class="task-row"
            :class="{ done: task.status === 'done' }"
          >
            <button
              class="status-circle"
              :class="task.status"
              @click="toggleTaskStatus(task)"
            >
              <svg v-if="task.status === 'done'" viewBox="0 0 24 24" width="14" height="14" fill="none">
                <path d="M5 12L10 17L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="task.status === 'in_progress'" viewBox="0 0 24 24" width="12" height="12">
                <circle cx="12" cy="12" r="5" fill="white" />
              </svg>
            </button>
            <div class="task-info">
              <div class="task-name" :class="{ done: task.status === 'done' }">{{ task.title }}</div>
              <div class="task-meta">
                <span v-if="task.startTime" class="meta-time">{{ task.startTime }}</span>
                <span v-if="task.priority === 'high'" class="meta-priority high">高</span>
                <span v-else-if="task.priority === 'medium'" class="meta-priority medium">中</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!groupedTasks.length" class="empty">
          <p>暂无任务</p>
        </div>
      </template>

      <!-- Todos tab -->
      <template v-else>
        <div class="task-group">
          <div class="group-header">待办池 · {{ filteredTodos.length }}</div>
          <div
            v-for="todo in filteredTodos"
            :key="todo.id"
            class="task-row"
          >
            <div class="todo-indicator">
              <span v-if="todo.importance > 0" class="importance">{{ importanceLabel[todo.importance] || '' }}</span>
            </div>
            <div class="task-info">
              <div class="task-name">{{ todo.title }}</div>
              <div class="task-meta">
                <span v-if="todo.estimatedStart" class="meta-time">{{ todo.estimatedStart.slice(5) }}</span>
                <span v-if="todo.estimatedEnd" class="meta-time">→ {{ todo.estimatedEnd.slice(5) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!filteredTodos.length" class="empty">
          <p>暂无待办</p>
        </div>
      </template>
    </div>

    <!-- FAB -->
    <button class="fab safe-bottom" @click="openAdd">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
        <path d="M12 5V19M5 12H19" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Quick add bottom sheet -->
    <div v-if="showAddSheet" class="sheet-overlay" @click="showAddSheet = false">
      <div class="sheet safe-bottom" @click.stop>
        <div class="sheet-handle" />
        <h3 class="sheet-title">快速添加任务</h3>
        <input
          v-model="newTaskTitle"
          type="text"
          placeholder="输入任务标题..."
          class="sheet-input"
          @keyup.enter="addQuickTask"
        />
        <div class="sheet-row">
          <label class="sheet-label">日期</label>
          <input v-model="newTaskDate" type="date" class="sheet-date" />
        </div>
        <div class="sheet-actions">
          <button class="sheet-btn cancel" @click="showAddSheet = false">取消</button>
          <button class="sheet-btn confirm" @click="addQuickTask">添加</button>
        </div>
      </div>
    </div>

    <!-- Reactivate confirm -->
    <ConfirmDialog
      :visible="taskStore.reactivateConfirm.visible"
      title="重新激活任务"
      :message="`将已完成任务「<strong>${taskStore.reactivateConfirm.taskTitle}</strong>」重新激活为待办？`"
      confirm-text="确认激活"
      type="warning"
      @confirm="taskStore.confirmReactivate()"
      @cancel="taskStore.cancelReactivate()"
    />
  </div>
</template>


<style scoped>
.task-app {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-1);
  display: flex;
  flex-direction: column;
}

.nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-border);
}

.nav-back, .nav-search {
  border: none;
  background: none;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-back:active, .nav-search:active {
  opacity: 0.5;
}

.nav-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
  text-align: center;
}

.tab-toggle {
  display: flex;
  margin: 12px 16px 0;
  background: var(--color-bg-2);
  border-radius: 10px;
  padding: 3px;
}

.tab-btn {
  flex: 1;
  border: none;
  background: none;
  padding: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--color-surface);
  color: var(--color-primary);
}

.filter-chips {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
}

.chip {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  font-size: 13px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.2s;
}

.chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 100px;
}

.task-group {
  margin-bottom: 8px;
}

.group-header {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-3);
  padding: 12px 4px 8px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: 12px;
  margin-bottom: 6px;
}

.task-row.done {
  opacity: 0.55;
}

.todo-indicator {
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.importance {
  font-size: 10px;
  color: #FF9500;
  letter-spacing: -1px;
}

.status-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-text-4);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.status-circle:active {
  transform: scale(0.85);
}

.status-circle.todo {
  border-color: #C7C7CC;
}

.status-circle.in_progress {
  border-color: #FF9500;
  background: #FF9500;
}

.status-circle.done {
  border-color: #34C759;
  background: #34C759;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 14px;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-name.done {
  text-decoration: line-through;
  color: var(--color-text-3);
}

.task-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.meta-time {
  font-size: 11px;
  color: var(--color-text-3);
}

.meta-priority {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
}

.meta-priority.high {
  color: #FF3B30;
  background: rgba(255,59,48,0.1);
}

.meta-priority.medium {
  color: #FF9500;
  background: rgba(255,149,0,0.1);
}

.empty {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-4);
  font-size: 14px;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 108, 247, 0.3);
  z-index: 10;
  transition: transform 0.15s;
}

.fab:active {
  transform: scale(0.9);
}

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 20;
  display: flex;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  background: var(--color-surface);
  border-radius: 20px 20px 0 0;
  padding: 12px 20px 24px;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-text-4);
  opacity: 0.3;
  margin: 0 auto 16px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 16px;
}

.sheet-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 15px;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  outline: none;
  margin-bottom: 12px;
}

.sheet-input:focus {
  border-color: var(--color-primary);
}

.sheet-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.sheet-label {
  font-size: 14px;
  color: var(--color-text-2);
}

.sheet-date {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  outline: none;
}

.sheet-actions {
  display: flex;
  gap: 12px;
}

.sheet-btn {
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.sheet-btn.cancel {
  background: var(--color-bg-2);
  color: var(--color-text-2);
}

.sheet-btn.confirm {
  background: var(--color-primary);
  color: white;
}
</style>
