<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useGrowthStore, ACHIEVEMENTS } from '@/stores/growth'
import SpiritIllustration from '@/components/SpiritIllustration.vue'

const growth = useGrowthStore()
onMounted(() => growth.load())

const unlockedIds = computed(() => new Set(growth.unlockedAchievements.map(r => r.id)))

// 成就按分类分组
const milestoneAchievements = ACHIEVEMENTS.filter(a => a.category === 'milestone')
const streakAchievements = ACHIEVEMENTS.filter(a => a.category === 'streak')
const specialAchievements = ACHIEVEMENTS.filter(a => a.category === 'special')
const hiddenAchievements = ACHIEVEMENTS.filter(a => a.category === 'hidden')

const xpPercent = computed(() => Math.round(growth.xpProgress * 100))

// 分类图标 SVG path
const categoryIcons: Record<string, string> = {
  milestone: 'M12 2l3 7h7l-5.5 4 2 7L12 15.5 5.5 20l2-7L2 9h7z',  // 星
  streak: 'M12 4a8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8zM12 4v16M4 12h16',  // 圈+十字
  special: 'M12 2l2 8h8l-6 4.5 2.5 8L12 18l-6.5 4.5 2.5-8L2 10h8z',  // 五角星
  hidden: 'M12 3a9 9 0 109 9M12 3a9 9 0 019 9',  // 半圆
}

const categoryLabels: Record<string, string> = {
  milestone: '里程碑',
  streak: '连续',
  special: '特殊',
  hidden: '隐藏',
}

// 分类颜色变量
const categoryColorVar: Record<string, string> = {
  milestone: 'var(--color-success-text)',
  streak: 'var(--color-warning-text)',
  special: 'var(--color-accent-text)',
  hidden: 'var(--color-text-3)',
}

// 分类背景变量
const categoryBgVar: Record<string, string> = {
  milestone: 'var(--color-success-light)',
  streak: 'var(--color-warning-light)',
  special: 'var(--color-accent-light)',
  hidden: 'var(--color-bg-3)',
}
</script>

<template>
  <div class="spirit-view">
    <!-- ===== 顶部大图 ===== -->
    <div class="spirit-view__hero">
      <!-- 环境光晕 -->
      <div class="spirit-view__ambient"></div>
      <SpiritIllustration
        :level="growth.level"
        :daily-state="growth.dailyState"
        size="lg"
      />
      <div class="spirit-view__hero-info">
        <div class="spirit-view__level-row">
          <span class="spirit-view__level">Lv.{{ growth.level }}</span>
          <span class="spirit-view__state-badge" :style="{ color: growth.dailyState === 'vitality' ? 'var(--color-success-text)' : growth.dailyState === 'recovery' ? 'var(--color-warning-text)' : 'var(--color-text-3)', background: growth.dailyState === 'vitality' ? 'var(--color-success-light)' : growth.dailyState === 'recovery' ? 'var(--color-warning-light)' : 'var(--color-bg-3)' }">
            {{ growth.dailyState === 'vitality' ? '活力' : growth.dailyState === 'recovery' ? '复苏' : '倦意' }}
          </span>
        </div>
        <div class="spirit-view__message">{{ growth.dailyMessage }}</div>
      </div>
    </div>

    <!-- ===== XP 进度详情 ===== -->
    <div class="spirit-view__xp-section">
      <div class="spirit-view__xp-header">
        <span class="spirit-view__xp-label">经验进度</span>
        <span class="spirit-view__xp-number">{{ growth.xp }} / {{ growth.xpToNext }} XP</span>
      </div>
      <div class="spirit-view__xp-bar-track">
        <div class="spirit-view__xp-bar-fill" :style="{ width: xpPercent + '%' }"></div>
      </div>
      <div class="spirit-view__xp-stats">
        <div class="spirit-view__stat-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          <span class="spirit-view__stat-value">{{ growth.totalXp }}</span>
          <span class="spirit-view__stat-label">累计 XP</span>
        </div>
        <div class="spirit-view__stat-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span class="spirit-view__stat-value">{{ growth.streakDays }}</span>
          <span class="spirit-view__stat-label">连续天数</span>
        </div>
        <div class="spirit-view__stat-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span class="spirit-view__stat-value">{{ growth.maxStreakDays }}</span>
          <span class="spirit-view__stat-label">最长连续</span>
        </div>
      </div>
    </div>

    <!-- ===== 成就列表 ===== -->
    <div class="spirit-view__achievements">
      <!-- 各分类渲染 -->
      <template v-for="cat in ['milestone', 'streak', 'special', 'hidden']" :key="cat">
        <div class="spirit-view__category">
          <div class="spirit-view__category-header">
            <svg class="spirit-view__cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="categoryColorVar[cat]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="categoryIcons[cat]"/>
            </svg>
            <span class="spirit-view__cat-label" :style="{ color: categoryColorVar[cat] }">{{ categoryLabels[cat] }}</span>
          </div>
          <div class="spirit-view__achievement-grid">
            <div
              v-for="a in (cat === 'milestone' ? milestoneAchievements : cat === 'streak' ? streakAchievements : cat === 'special' ? specialAchievements : hiddenAchievements)"
              :key="a.id"
              :class="[
                'spirit-view__achievement-item',
                {
                  'spirit-view__achievement-item--unlocked': unlockedIds.has(a.id),
                  'spirit-view__achievement-item--locked': !unlockedIds.has(a.id) && !a.isHidden,
                  'spirit-view__achievement-item--hidden': a.isHidden && !unlockedIds.has(a.id),
                }
              ]"
              :style="{ '--cat-color': categoryColorVar[cat], '--cat-bg': categoryBgVar[cat] }"
            >
              <!-- 已解锁：实心图标 -->
              <div v-if="unlockedIds.has(a.id)" class="spirit-view__achievement-dot spirit-view__achievement-dot--active" :style="{ background: categoryColorVar[cat] }"></div>
              <!-- 未解锁非隐藏：空心图标 -->
              <div v-else-if="!a.isHidden" class="spirit-view__achievement-dot" :style="{ borderColor: categoryColorVar[cat] }"></div>
              <!-- 隐藏未解锁：问号图标 -->
              <div v-else class="spirit-view__achievement-dot spirit-view__achievement-dot--mystery"></div>

              <div class="spirit-view__achievement-content">
                <span class="spirit-view__achievement-name">
                  {{ unlockedIds.has(a.id) ? a.name : (a.isHidden ? '???' : a.name) }}
                </span>
                <span class="spirit-view__achievement-desc">
                  {{ unlockedIds.has(a.id) ? a.description : (a.isHidden ? '条件不公开' : a.condition) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.spirit-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 28px 28px;
  overflow-y: auto;
  height: 100%;
}

/* ===== Hero 区域（横向布局） ===== */
.spirit-view__hero {
  display: flex;
  align-items: center;
  gap: 28px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 64px 36px;
  box-shadow: 0 2px 8px var(--color-shadow);
  position: relative;
  overflow: hidden;
}

/* 环境光晕：烛焰投射到卡片上的微光 */
.spirit-view__ambient {
  position: absolute;
  top: -30%;
  left: -10%;
  width: 60%;
  height: 80%;
  background: radial-gradient(ellipse at center, var(--color-warning-light) 0%, transparent 70%);
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.spirit-view__hero > :not(.spirit-view__ambient) {
  z-index: 1;
}

.spirit-view__hero-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spirit-view__level-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spirit-view__level {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-1);
  letter-spacing: -0.03em;
}

.spirit-view__state-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 12px;
}

.spirit-view__message {
  font-size: 15px;
  color: var(--color-text-2);
  line-height: 1.5;
}

/* ===== XP 区域 ===== */
.spirit-view__xp-section {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 18px 22px;
  box-shadow: 0 1px 4px var(--color-shadow);
}

.spirit-view__xp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.spirit-view__xp-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.spirit-view__xp-number {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
}

.spirit-view__xp-bar-track {
  height: 12px;
  background: var(--color-bg-4);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;
}

.spirit-view__xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-warning), var(--color-primary));
  border-radius: 6px;
  transition: width 0.6s ease;
  position: relative;
}

.spirit-view__xp-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.25), transparent);
}

.spirit-view__xp-stats {
  display: flex;
  gap: 20px;
}

.spirit-view__stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-3);
}

.spirit-view__stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.spirit-view__stat-label {
  font-size: 12px;
  color: var(--color-text-3);
}

/* ===== 成就分类 ===== */
.spirit-view__achievements {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.spirit-view__category {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spirit-view__category-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spirit-view__cat-icon {
  flex-shrink: 0;
}

.spirit-view__cat-label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.spirit-view__achievement-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== 成就条目 ===== */
.spirit-view__achievement-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--cat-bg);
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid transparent;
  transition: opacity 0.3s, border-color 0.3s;
}

.spirit-view__achievement-item--unlocked {
  border-color: var(--cat-color);
  opacity: 1;
}

.spirit-view__achievement-item--locked {
  opacity: 0.55;
  border-color: var(--color-border-light);
}

.spirit-view__achievement-item--hidden {
  opacity: 0.3;
  border-color: var(--color-border-light);
  background: var(--color-bg-3);
}

/* 成就状态圆点 */
.spirit-view__achievement-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--cat-color);
  flex-shrink: 0;
  transition: all 0.3s;
}

.spirit-view__achievement-dot--active {
  border-color: transparent;
  background: var(--cat-color);
}

.spirit-view__achievement-dot--mystery {
  border-color: var(--color-text-4);
  background: var(--color-bg-4);
  position: relative;
}

/* 问号样式 */
.spirit-view__achievement-dot--mystery::after {
  content: '?';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  color: var(--color-text-4);
}

.spirit-view__achievement-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.spirit-view__achievement-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.spirit-view__achievement-desc {
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.3;
}
</style>