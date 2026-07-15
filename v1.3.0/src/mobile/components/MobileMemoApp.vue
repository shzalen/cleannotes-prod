<script setup lang="ts">
/**
 * 移动端子应用：备忘录列表与详情
 */
import { ref, computed, onMounted } from 'vue'
import { useMemoStore } from '@/stores/memo'
import { showConfirmDialog, showToast } from 'vant'
import DOMPurify from 'dompurify'

defineOptions({ name: 'MobileMemoApp' })

const memoStore = useMemoStore()

const pinnedMemos = computed(() => memoStore.pinnedMemos)
const normalMemos = computed(() => memoStore.normalMemos)
const allTags = computed(() => memoStore.allTags)

const searchQuery = ref('')
const selectedTag = ref('')

// 过滤
const filteredPinned = computed(() => {
  if (!searchQuery.value && !selectedTag.value) return pinnedMemos.value
  return pinnedMemos.value.filter(m => {
    if (searchQuery.value && !m.title.includes(searchQuery.value) && !memoStore.stripHtml(m.content).includes(searchQuery.value)) return false
    if (selectedTag.value && !m.tags.includes(selectedTag.value)) return false
    return true
  })
})

const filteredNormal = computed(() => {
  if (!searchQuery.value && !selectedTag.value) return normalMemos.value
  return normalMemos.value.filter(m => {
    if (searchQuery.value && !m.title.includes(searchQuery.value) && !memoStore.stripHtml(m.content).includes(searchQuery.value)) return false
    if (selectedTag.value && !m.tags.includes(selectedTag.value)) return false
    return true
  })
})

// 查看详情
const viewingMemo = ref<any>(null)
const showDetail = ref(false)

function viewMemo(memo: any) {
  viewingMemo.value = memo
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  viewingMemo.value = null
}

const renderedContent = computed(() => {
  if (!viewingMemo.value?.content) return '<p style="color:var(--color-text-4)">无内容</p>'
  return DOMPurify.sanitize(viewingMemo.value.content)
})

// 添加备忘录
const showAddForm = ref(false)
const newTitle = ref('')
const newContent = ref('')
const newTags = ref('')
const newIcon = ref('📝')

function openAddForm() {
  newTitle.value = ''
  newContent.value = ''
  newTags.value = ''
  newIcon.value = '📝'
  showAddForm.value = true
}

async function saveMemo() {
  const t = newTitle.value.trim()
  if (!t) {
    showToast('请输入备忘录标题')
    return
  }
  const tags = newTags.value.split(',').map(s => s.trim()).filter(Boolean)
  memoStore.addMemo({
    title: t,
    content: newContent.value.trim(),
    tags,
    icon: newIcon.value,
    pinned: false,
  })
  showToast('已保存')
  showAddForm.value = false
}

// 删除
async function removeMemo(memo: any) {
  showConfirmDialog({
    title: '删除备忘录',
    message: `确定删除「${memo.title}」？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    memoStore.removeMemo(memo.id)
    showToast('已删除')
  }).catch(() => {})
}

function stripHtml(html: string): string {
  return memoStore.stripHtml(html)
}

onMounted(() => {
  memoStore.load()
})
</script>

<template>
  <div class="memo-app">
    <!-- 搜索和标签 -->
    <div class="app-search">
      <input v-model="searchQuery" class="app-search__input" placeholder="搜索备忘录..." />
      <div class="app-search__tags" v-if="allTags.length > 0">
        <button
          v-for="tag in allTags"
          :key="tag"
          class="app-tag"
          :class="{ active: selectedTag === tag }"
          @click="selectedTag = selectedTag === tag ? '' : tag"
        >{{ tag }}</button>
      </div>
    </div>

    <!-- 置顶备忘 -->
    <div v-if="filteredPinned.length > 0" class="memo-section">
      <p class="memo-section__label">置顶</p>
      <div class="memo-list">
        <div
          v-for="memo in filteredPinned"
          :key="memo.id"
          class="memo-card"
          @click="viewMemo(memo)"
        >
          <span class="memo-card__icon">{{ memo.icon || '📄' }}</span>
          <div class="memo-card__body">
            <p class="memo-card__title">{{ memo.title || '无标题' }}</p>
            <p class="memo-card__preview">{{ stripHtml(memo.content).slice(0, 80) || '无内容' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 普通备忘 -->
    <div class="memo-section">
      <p class="memo-section__label" v-if="filteredPinned.length > 0">全部</p>
      <div class="memo-list" v-if="filteredNormal.length > 0">
        <div
          v-for="memo in filteredNormal"
          :key="memo.id"
          class="memo-card"
          @click="viewMemo(memo)"
        >
          <span class="memo-card__icon">{{ memo.icon || '📄' }}</span>
          <div class="memo-card__body">
            <p class="memo-card__title">{{ memo.title || '无标题' }}</p>
            <p class="memo-card__preview">{{ stripHtml(memo.content).slice(0, 80) || '无内容' }}</p>
          </div>
        </div>
      </div>
      <div v-else-if="filteredPinned.length === 0" class="app-empty">
        <p>{{ searchQuery || selectedTag ? '无匹配结果' : '暂无备忘录' }}</p>
      </div>
    </div>

    <!-- FAB -->
    <button class="app-fab" @click="openAddForm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      teleport="body"
      :style="{ height: '80%', '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="detail-view" v-if="viewingMemo">
        <div class="detail-view__header">
          <div class="detail-view__header-left">
            <span class="detail-view__icon">{{ viewingMemo.icon || '📄' }}</span>
            <h3 class="detail-view__title">{{ viewingMemo.title || '无标题' }}</h3>
          </div>
          <div class="detail-view__header-actions">
            <button class="detail-view__del-btn" @click="removeMemo(viewingMemo); closeDetail()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
            <button class="detail-view__close-btn" @click="closeDetail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div class="detail-view__body" v-html="renderedContent"></div>
      </div>
    </van-popup>

    <!-- 添加表单弹窗 -->
    <van-popup
      v-model:show="showAddForm"
      position="bottom"
      round
      teleport="body"
      :style="{ height: '65%', '--van-popup-background': 'var(--color-surface)' }"
    >
      <div class="add-form">
        <div class="add-form__header">
          <span class="add-form__title">新建备忘录</span>
          <button class="add-form__close" @click="showAddForm = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="add-form__body">
          <van-cell-group inset>
            <van-field v-model="newTitle" label="标题" placeholder="输入标题" clearable />
          </van-cell-group>
          <div class="form-section">
            <label class="form-label">图标</label>
            <input v-model="newIcon" class="form-input" placeholder="输入 emoji" maxlength="4" />
          </div>
          <div class="form-section">
            <label class="form-label">标签（逗号分隔）</label>
            <input v-model="newTags" class="form-input" placeholder="工作, 个人..." />
          </div>
          <div class="form-section">
            <label class="form-label">内容</label>
            <textarea v-model="newContent" class="form-textarea" placeholder="输入内容..." rows="4"></textarea>
          </div>
        </div>
        <div class="add-form__footer">
          <van-button type="primary" block round @click="saveMemo">保存</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.memo-app { padding: 12px 12px 80px; min-height: 100%; position: relative; }

.app-search { margin-bottom: 12px; }
.app-search__input { width: 100%; padding: 10px 12px; font-size: 14px; color: var(--color-text-1); background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 10px; outline: none; box-sizing: border-box; }
.app-search__input:focus { border-color: var(--color-primary); }
.app-search__tags { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.app-tag { padding: 4px 10px; font-size: 12px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text-2); cursor: pointer; transition: all 0.15s; }
.app-tag.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

.memo-section { margin-bottom: 12px; }
.memo-section__label { font-size: 12px; font-weight: 600; color: var(--color-text-3); padding: 0 4px; margin-bottom: 8px; }
.memo-list { display: flex; flex-direction: column; gap: 8px; }

.memo-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: var(--color-surface); border-radius: 12px; box-shadow: 0 1px 3px var(--color-shadow); cursor: pointer; }
.memo-card:active { transform: scale(0.98); }
.memo-card__icon { font-size: 22px; flex-shrink: 0; line-height: 1.4; }
.memo-card__body { flex: 1; min-width: 0; }
.memo-card__title { margin: 0; font-size: 15px; font-weight: 500; color: var(--color-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.memo-card__preview { margin: 3px 0 0; font-size: 12px; color: var(--color-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.app-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 0; color: var(--color-text-3); font-size: 14px; }
.app-fab { position: fixed; right: 16px; bottom: calc(var(--safe-bottom) + 24px); width: 48px; height: 48px; border-radius: 50%; border: none; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 40%, rgba(0,0,0,0.2)); cursor: pointer; z-index: 10; }
.app-fab svg { width: 22px; height: 22px; }

/* 详情弹窗 */
.detail-view { display: flex; flex-direction: column; height: 100%; }
.detail-view__header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--color-border-light); flex-shrink: 0; }
.detail-view__header-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.detail-view__icon { font-size: 20px; flex-shrink: 0; }
.detail-view__title { margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-view__header-actions { display: flex; gap: 4px; flex-shrink: 0; }
.detail-view__del-btn, .detail-view__close-btn { border: none; background: transparent; color: var(--color-text-3); display: flex; padding: 4px; cursor: pointer; }
.detail-view__del-btn svg, .detail-view__close-btn svg { width: 18px; height: 18px; }
.detail-view__body { flex: 1; overflow-y: auto; padding: 16px; font-size: 14px; line-height: 1.75; color: var(--color-text-2); word-break: break-word; }

/* 添加表单 */
.add-form { display: flex; flex-direction: column; height: 100%; }
.add-form__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px; border-bottom: 1px solid var(--color-border-light); flex-shrink: 0; }
.add-form__title { font-size: 16px; font-weight: 600; color: var(--color-text-1); }
.add-form__close { border: none; background: transparent; color: var(--color-text-3); display: flex; padding: 4px; cursor: pointer; }
.add-form__close svg { width: 20px; height: 20px; }
.add-form__body { flex: 1; overflow-y: auto; padding: 12px 0; }
.add-form__footer { padding: 12px 16px calc(12px + var(--safe-bottom)); border-top: 1px solid var(--color-border-light); flex-shrink: 0; }

.form-section { padding: 8px 16px; }
.form-label { display: block; font-size: 12px; font-weight: 500; color: var(--color-text-3); margin-bottom: 6px; }
.form-input { width: 100%; padding: 8px 10px; font-size: 14px; color: var(--color-text-1); background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 8px; outline: none; box-sizing: border-box; }
.form-input:focus { border-color: var(--color-primary); }
.form-textarea { width: 100%; padding: 10px 12px; font-size: 14px; color: var(--color-text-1); background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 8px; outline: none; resize: vertical; font-family: inherit; line-height: 1.6; box-sizing: border-box; }
.form-textarea:focus { border-color: var(--color-primary); }
</style>
