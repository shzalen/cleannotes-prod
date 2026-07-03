<script setup lang="ts">
import { useGrowthStore } from '@/stores/growth'

const growth = useGrowthStore()
</script>

<template>
  <div class="streak-badge" v-if="growth.streakDays > 0">
    <svg class="streak-badge__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z"/>
    </svg>
    <span class="streak-badge__count">{{ growth.streakDays }}</span>
    <span class="streak-badge__label">天连续</span>
  </div>
</template>

<style scoped>
.streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-warning-light);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 13px;
  color: var(--color-warning-text);
}

.streak-badge__icon {
  flex-shrink: 0;
}

.streak-badge__count {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.02em;
}

.streak-badge__label {
  font-weight: 400;
}
</style>