<script setup lang="ts">
import { computed } from 'vue'
import { useGrowthStore } from '@/stores/growth'
import { useTheme } from '@/composables/useTheme'
import SpiritIllustration from '@/components/SpiritIllustration.vue'

const growth = useGrowthStore()
const { isDark } = useTheme()

const xpPercent = computed(() => Math.round(growth.xpProgress * 100))

// 状态标签
const stateLabel = computed(() => {
  switch (growth.dailyState) {
    case 'vitality': return '活力'
    case 'recovery': return '复苏'
    case 'withered': return '倦意'
  }
})

// 状态色（CSS 变量方式，避免 hex）
const stateColorVar = computed(() => {
  switch (growth.dailyState) {
    case 'vitality': return 'var(--color-success-text)'
    case 'recovery': return 'var(--color-warning-text)'
    case 'withered': return 'var(--color-text-3)'
  }
})
</script>

<template>
  <div class="spirit-widget" @click="$router.push('/spirit')">
    <div class="spirit-widget__illustration">
      <SpiritIllustration
        :level="growth.level"
        :daily-state="growth.dailyState"
        size="md"
      />
    </div>
    <div class="spirit-widget__info">
      <div class="spirit-widget__header">
        <span class="spirit-widget__level">Lv.{{ growth.level }}</span>
        <span class="spirit-widget__state" :style="{ color: stateColorVar }">{{ stateLabel }}</span>
      </div>
      <div class="spirit-widget__progress">
        <div class="spirit-widget__bar">
          <div class="spirit-widget__fill" :style="{ width: xpPercent + '%' }"></div>
        </div>
        <span class="spirit-widget__xp-text">{{ growth.xp }}/{{ growth.xpToNext }} XP</span>
      </div>
      <div class="spirit-widget__footer">
        <span class="spirit-widget__streak-badge" v-if="growth.streakDays > 0">
          <svg class="streak-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z"/>
          </svg>
          {{ growth.streakDays }} 天连续
        </span>
        <span class="spirit-widget__message">{{ growth.dailyMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spirit-widget {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  position: relative;
}

.spirit-widget:hover {
  box-shadow: 0 3px 12px var(--color-shadow-md);
  transform: translateY(-1px);
}

.spirit-widget__illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.spirit-widget__info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.spirit-widget__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spirit-widget__level {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-1);
  letter-spacing: -0.02em;
}

.spirit-widget__state {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-bg-3);
}

.spirit-widget__progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spirit-widget__bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-4);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.spirit-widget__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-warning), var(--color-primary));
  border-radius: 4px;
  transition: width 0.6s ease;
  position: relative;
}

/* 进度条内部光泽 */
.spirit-widget__fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.25), transparent);
}

.spirit-widget__xp-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-3);
  white-space: nowrap;
}

.spirit-widget__footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spirit-widget__streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-warning-text);
  background: var(--color-warning-light);
  padding: 3px 10px;
  border-radius: 12px;
}

.streak-icon {
  flex-shrink: 0;
}

.spirit-widget__message {
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.4;
  font-weight: 400;
}
</style>