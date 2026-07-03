<script setup lang="ts">
import { computed } from 'vue'
import { useGrowthStore, ACHIEVEMENTS } from '@/stores/growth'

const growth = useGrowthStore()

const recentUnlocked = computed(() => {
  const records = growth.unlockedAchievements.slice(-3).reverse()
  return records.map(r => {
    const def = ACHIEVEMENTS.find(a => a.id === r.id)
    return { ...r, name: def?.name ?? r.id, description: def?.description ?? '', category: def?.category ?? 'milestone' }
  })
})

// 分类颜色
const catColorVar: Record<string, string> = {
  milestone: 'var(--color-success-text)',
  streak: 'var(--color-warning-text)',
  special: 'var(--color-accent-text)',
  hidden: 'var(--color-text-3)',
}

const catBgVar: Record<string, string> = {
  milestone: 'var(--color-success-light)',
  streak: 'var(--color-warning-light)',
  special: 'var(--color-accent-light)',
  hidden: 'var(--color-bg-3)',
}
</script>

<template>
  <div class="achievement-card" v-if="recentUnlocked.length > 0">
    <div class="achievement-card__header">
      <svg class="achievement-card__header-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3 7h7l-5.5 4 2 7L12 15.5 5.5 20l2-7L2 9h7z"/>
      </svg>
      最近成就
    </div>
    <div class="achievement-card__list">
      <div v-for="a in recentUnlocked" :key="a.id" class="achievement-card__item" :style="{ '--cat-color': catColorVar[a.category] ?? 'var(--color-success-text)', '--cat-bg': catBgVar[a.category] ?? 'var(--color-success-light)' }">
        <div class="achievement-card__dot" :style="{ background: catColorVar[a.category] ?? 'var(--color-success-text)' }"></div>
        <span class="achievement-card__name">{{ a.name }}</span>
        <span class="achievement-card__desc">{{ a.description }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.achievement-card {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px 18px;
  box-shadow: 0 1px 4px var(--color-shadow);
}

.achievement-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-warning-text);
  margin-bottom: 10px;
}

.achievement-card__header-icon {
  flex-shrink: 0;
}

.achievement-card__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.achievement-card__item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--cat-bg);
  border-radius: 8px;
  padding: 8px 12px;
}

.achievement-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.achievement-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cat-color);
  min-width: 40px;
}

.achievement-card__desc {
  font-size: 12px;
  color: var(--color-text-3);
}
</style>