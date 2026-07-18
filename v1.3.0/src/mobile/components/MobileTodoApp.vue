<script setup lang="ts">
/**
 * 移动端子应用：待办事项
 * CRUD：新增（胶囊菜单）、查看（点击卡片）、编辑（左滑/详情入口）、删除（左滑/详情入口）
 */
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { showConfirmDialog, showToast } from 'vant'
import { SwipeCell as VanSwipeCell } from 'vant'
import type { TodoItem } from '@/stores/todo'
import { SUBAPP_MENU_KEY, type SubAppMenuApi } from '../composables/useSubAppMenu'

defineOptions({ name: 'MobileTodoApp' })

const todoStore = useTodoStore()
const subAppMenu = inject<SubAppMenuApi>(SUBAPP_MENU_KEY)

const todos = computed(() => todoStore.activeTodos)

// ── 表单弹窗（新增/编辑共用） ──
type FormMode = 'new' | 'edit'
const showForm = ref(false)
const formMode = ref<FormMode>('new')
const editingId = ref<string | null>(null)
const fTitle = ref('')
const fImportance = ref(0)
const fEstStart = ref('')
const fEstEnd = ref('')
const fDesc = ref('')

function openNew() {
  formMode.value = 'new'
  editingId.value = null
  fTitle.value = ''
  fImportance.value = 0
  fEstStart.value = ''
  fEstEnd.value = ''
  fDesc.value = ''
  showForm.value = true
}

function openEdit(item: TodoItem) {
  formMode.value = 'edit'
  editingId.value = item.id
  fTitle.value = item.title
  fImportance.value = item.importance ?? 0
  fEstStart.value = item.estimatedStart || ''
  fEstEnd.value = item.estimatedEnd || ''
  fDesc.value = item.description || ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

function saveForm() {
  const t = fTitle.value.trim()
  if (!t) {
    showToast('请输入待办标题')
    return
  }
  const payload = {
    title: t,
    description: fDesc.value.trim(),
    importance: fImportance.value,
    estimatedStart: fEstStart.value || null,
    estimatedEnd: fEstEnd.value || null,
  }
  if (formMode.value === 'new') {
    todoStore.addTodo(payload)
    showToast('已添加')
  } else if (editingId.value) {
    todoStore.updateTodo(editingId.value, payload)
    showToast('已保存')
  }
  closeForm()
}

// 点击星级：同号降级（与 PC 端一致）
function setImportance(n: number) {
  fImportance.value = fImportance.value === n ? n - 1 : n
}

// ── 查看详情弹窗 ──
const showDetail = ref(false)
const detailItem = ref<TodoItem | null>(null)

function viewDetail(item: TodoItem) {
  detailItem.value = item
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  detailItem.value = null
}

function editFromDetail() {
  if (!detailItem.value) return
  const item = detailItem.value
  closeDetail()
  // 稍延迟避免两个 popup 同时开关的视觉抖动
  setTimeout(() => openEdit(item), 150)
}

function deleteFromDetail() {
  if (!detailItem.value) return
  const item = detailItem.value
  showConfirmDialog({
    title: '删除待办',
    message: `确定删除「${item.title}」？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    todoStore.removeTodo(item.id)
    showToast('已删除')
    closeDetail()
  }).catch(() => {})
}

// 左滑删除（列表项）
function swipeDelete(item: TodoItem) {
  showConfirmDialog({
    title: '删除待办',
    message: `确定删除「${item.title}」？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    todoStore.removeTodo(item.id)
    showToast('已删除')
  }).catch(() => {})
}

// 星级显示
function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

onMounted(() => {
  todoStore.load()
  subAppMenu?.setActions([{ name: '新增待办', key: 'add' }])
  subAppMenu?.onSelect((key) => {
    if (key === 'add') openNew()
  })
})

onUnmounted(() => {
  subAppMenu?.clearActions()
})
</script>

<template>
  <div class="todo-app">
    <!-- 统计条 -->
    <div class="app-stats">
      <span class="app-stats__item">共 {{ todos.length }} 项</span>
      <span class="app-stats__item">已排期 {{ todos.filter(t => t.estimatedStart).length }}</span>
    </div>

    <!-- 骨架屏：首次加载 -->
    <div v-if="!todoStore.loaded" class="skeleton-list">
      <div v-for="i in 4" :key="'sk-'+i" class="skeleton-card">
        <div class="skeleton-card__stars sk-pulse" />
        <div class="skeleton-card__title sk-pulse" />
        <div class="skeleton-card__desc sk-pulse" />
      </div>
    </div>

    <!-- 待办列表（左滑编辑/删除） -->
    <div class="app-list" v-else-if="todos.length > 0">
      <van-swipe-cell
        v-for="item in todos"
        :key="item.id"
        :right-width="112"
        :stop-propagation="true"
      >
        <div class="app-card" @click="viewDetail(item)">
          <div class="app-card__body">
            <div class="app-card__top">
              <span class="app-card__stars">{{ stars(item.importance ?? 0) }}</span>
            </div>
            <p class="app-card__title">{{ item.title }}</p>
            <div class="app-card__dates" v-if="item.estimatedStart || item.estimatedEnd">
              <span v-if="item.estimatedStart">{{ item.estimatedStart }}</span>
              <span v-if="item.estimatedStart && item.estimatedEnd"> ~ </span>
              <span v-if="item.estimatedEnd">{{ item.estimatedEnd }}</span>
            </div>
            <p class="app-card__desc" v-if="item.description">{{ item.description }}</p>
          </div>
        </div>
        <template #right>
          <div class="swipe-actions">
            <button class="swipe-btn swipe-btn--edit" @click="openEdit(item)">编辑</button>
            <button class="swipe-btn swipe-btn--del" @click="swipeDelete(item)">删除</button>
          </div>
        </template>
      </van-swipe-cell>
    </div>

    <div v-else-if="todoStore.loaded && todos.length === 0" class="app-empty">
      <p>暂无待办事项</p>
      <p class="app-empty__hint">点击右上角 ··· 添加</p>
    </div>

    <!-- 新增/编辑表单弹窗 -->
    <van-popup
      v-model:show="showForm"
      position="bottom"
      round
      teleport="body"
      :style="{ height: '65%', '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="add-form">
        <div class="add-form__header">
          <span class="add-form__title">{{ formMode === 'new' ? '添加待办' : '编辑待办' }}</span>
          <button class="add-form__close" @click="closeForm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="add-form__body">
          <van-cell-group inset>
            <van-field v-model="fTitle" label="标题" placeholder="输入待办标题" clearable />
          </van-cell-group>
          <div class="form-section">
            <label class="form-label">重要等级</label>
            <div class="star-picker">
              <button
                v-for="i in 5"
                :key="i"
                type="button"
                class="star-picker__btn"
                :class="{ active: i <= fImportance }"
                @click="setImportance(i)"
              >{{ i <= fImportance ? '★' : '☆' }}</button>
              <span class="star-picker__hint">{{ fImportance > 0 ? `${fImportance}级` : '未评级' }}</span>
            </div>
          </div>
          <van-cell-group inset>
            <van-field v-model="fEstStart" label="预计开始" placeholder="选择日期" readonly clickable>
              <template #right-icon>
                <input v-model="fEstStart" type="date" class="native-input" />
              </template>
            </van-field>
            <van-field v-model="fEstEnd" label="预计结束" placeholder="选择日期" readonly clickable>
              <template #right-icon>
                <input v-model="fEstEnd" type="date" class="native-input" />
              </template>
            </van-field>
          </van-cell-group>
          <div class="form-section">
            <label class="form-label">描述</label>
            <textarea v-model="fDesc" class="form-textarea" placeholder="输入描述..." rows="3"></textarea>
          </div>
        </div>
        <div class="add-form__footer">
          <van-button type="primary" block round @click="saveForm">
            {{ formMode === 'new' ? '添加' : '保存' }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 查看详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      teleport="body"
      :style="{ height: '75%', '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="detail-view" v-if="detailItem">
        <div class="detail-view__header">
          <span class="detail-view__title">待办详情</span>
          <button class="detail-view__close" @click="closeDetail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="detail-view__body">
          <div class="detail-view__stars">{{ stars(detailItem.importance ?? 0) }}</div>
          <h2 class="detail-view__name">{{ detailItem.title }}</h2>
          <div class="detail-view__dates" v-if="detailItem.estimatedStart || detailItem.estimatedEnd">
            <span v-if="detailItem.estimatedStart">{{ detailItem.estimatedStart }}</span>
            <span v-if="detailItem.estimatedStart && detailItem.estimatedEnd"> ~ </span>
            <span v-if="detailItem.estimatedEnd">{{ detailItem.estimatedEnd }}</span>
          </div>
          <div class="detail-view__desc" v-if="detailItem.description">{{ detailItem.description }}</div>
          <div class="detail-view__empty" v-else>暂无描述</div>
        </div>
        <div class="detail-view__footer">
          <van-button block round plain type="danger" @click="deleteFromDetail">删除</van-button>
          <van-button block round type="primary" @click="editFromDetail">编辑</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.todo-app {
  padding: 12px 12px 80px;
  min-height: 100%;
  position: relative;
}

.app-stats {
  display: flex;
  gap: 16px;
  padding: 0 4px 12px;
  font-size: 12px;
  color: var(--color-text-3);
}

.app-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-card {
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}
.app-card:active { transform: scale(0.98); }

.app-card__body { padding: 12px 14px; }

.app-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.app-card__stars {
  font-size: 14px;
  color: var(--color-warning);
  letter-spacing: 1px;
}

.app-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.app-card__dates {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}

.app-card__desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 左滑按钮 */
.swipe-actions {
  display: flex;
  height: 100%;
}
.swipe-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 100%;
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.swipe-btn--edit { background: var(--color-primary); }
.swipe-btn--del  { background: var(--color-danger); }

.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: var(--color-text-3);
  font-size: 14px;
}
.app-empty__hint { font-size: 12px; opacity: 0.7; margin-top: 4px; }

/* 新增/编辑表单 */
.add-form { display: flex; flex-direction: column; height: 100%; }
.add-form__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px; border-bottom: 1px solid var(--color-border-light); flex-shrink: 0; }
.add-form__title { font-size: 16px; font-weight: 600; color: var(--color-text-1); }
.add-form__close { border: none; background: transparent; color: var(--color-text-3); display: flex; padding: 4px; cursor: pointer; }
.add-form__close svg { width: 20px; height: 20px; }
.add-form__body { flex: 1; overflow-y: auto; padding: 12px 0; }
.add-form__footer { padding: 12px 16px calc(12px + var(--safe-bottom)); border-top: 1px solid var(--color-border-light); flex-shrink: 0; }

.form-section { padding: 8px 16px; }
.form-label { display: block; font-size: 12px; font-weight: 500; color: var(--color-text-3); margin-bottom: 6px; }
.form-textarea { width: 100%; padding: 10px 12px; font-size: 14px; color: var(--color-text-1); background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 8px; outline: none; resize: vertical; font-family: inherit; line-height: 1.6; box-sizing: border-box; }
.form-textarea:focus { border-color: var(--color-primary); }

.star-picker { display: flex; align-items: center; gap: 4px; }
.star-picker__btn { border: none; background: transparent; font-size: 24px; color: var(--color-text-4); cursor: pointer; padding: 0 2px; line-height: 1; }
.star-picker__btn.active { color: var(--color-warning); }
.star-picker__hint { font-size: 11px; color: var(--color-text-4); margin-left: 6px; }

.native-input { border: none; background: transparent; font-size: 14px; color: var(--color-text-1); outline: none; width: auto; }

/* 查看详情弹窗 */
.detail-view { display: flex; flex-direction: column; height: 100%; }
.detail-view__header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--color-border-light); flex-shrink: 0; }
.detail-view__title { font-size: 16px; font-weight: 600; color: var(--color-text-1); }
.detail-view__close { border: none; background: transparent; color: var(--color-text-3); display: flex; padding: 4px; cursor: pointer; }
.detail-view__close svg { width: 20px; height: 20px; }

.detail-view__body { flex: 1; overflow-y: auto; padding: 16px; -webkit-overflow-scrolling: touch; }
.detail-view__stars { font-size: 18px; color: var(--color-warning); letter-spacing: 2px; margin-bottom: 10px; }
.detail-view__name { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--color-text-1); line-height: 1.4; }
.detail-view__dates { font-size: 13px; color: var(--color-text-3); margin-bottom: 12px; }
.detail-view__desc { font-size: 14px; color: var(--color-text-2); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.detail-view__empty { font-size: 13px; color: var(--color-text-4); font-style: italic; }

.detail-view__footer { display: flex; gap: 10px; padding: 12px 16px calc(12px + var(--safe-bottom)); border-top: 1px solid var(--color-border-light); flex-shrink: 0; }

/* 骨架屏 */
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-card {
  padding: 12px 14px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
}
.skeleton-card__stars { height: 14px; width: 80px; border-radius: 4px; margin-bottom: 8px; }
.skeleton-card__title { height: 15px; width: 70%; border-radius: 4px; margin-bottom: 8px; }
.skeleton-card__desc  { height: 12px; width: 40%; border-radius: 4px; }
.sk-pulse { background: var(--color-bg-4); animation: sk-pulse 1.4s ease-in-out infinite; }
@keyframes sk-pulse { 0%{opacity:1} 50%{opacity:.4} 100%{opacity:1} }
</style>
