<script setup lang="ts">
/**
 * 节日问候卡片 — 当天首次打开 app 时弹出
 *
 * 内容：节日相关图片 + 节日起源 + 说明 + 问候语
 * 触发：useHolidayGreeting composable 控制 showCard
 * 一次/天：localStorage 记录当天已展示
 */
import { computed, onMounted } from 'vue'
import { useHolidayGreeting } from '../composables/useHolidayGreeting'

const { showCard, currentHoliday, closeCard } = useHolidayGreeting()

const accent = computed(() => currentHoliday.value?.accentColor || '#e63946')

function handleClose() {
  closeCard()
}

// 图片加载失败兜底：用渐变占位
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

onMounted(() => {
  // 卡片显示由 MobileApp 调用 checkAndShowHolidayCard 触发
})
</script>

<template>
  <transition name="holiday-fade">
    <div
      v-if="showCard && currentHoliday"
      class="holiday-overlay"
      @click.self="handleClose"
    >
      <div class="holiday-card" :style="{ '--accent': accent }">
        <!-- 关闭按钮 -->
        <button class="holiday-close" @click="handleClose" aria-label="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <!-- 节日图片 -->
        <div class="holiday-card__image-wrap">
          <img
            :src="currentHoliday.image"
            :alt="currentHoliday.name"
            class="holiday-card__image"
            @error="onImgError"
          />
          <div class="holiday-card__image-overlay" />
          <div class="holiday-card__name-badge">
            <span class="holiday-card__name">{{ currentHoliday.name }}</span>
            <span class="holiday-card__date">{{ currentHoliday.solarDate }}</span>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="holiday-card__body">
          <!-- 问候语 -->
          <p class="holiday-card__greeting">{{ currentHoliday.greeting }}</p>

          <!-- 起源 -->
          <div class="holiday-card__section">
            <h3 class="holiday-card__section-title">
              <span class="holiday-card__section-icon">📜</span>
              节日起源
            </h3>
            <p class="holiday-card__section-text">{{ currentHoliday.origin }}</p>
          </div>

          <!-- 说明 -->
          <div class="holiday-card__section">
            <h3 class="holiday-card__section-title">
              <span class="holiday-card__section-icon">✨</span>
              节日习俗
            </h3>
            <p class="holiday-card__section-text">{{ currentHoliday.description }}</p>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="holiday-card__footer">
          <button class="holiday-card__btn" @click="handleClose">
            {{ currentHoliday.name }}快乐
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.holiday-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.holiday-card {
  position: relative;
  width: 100%;
  max-width: 340px;
  max-height: 85vh;
  background: var(--color-surface);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  animation: card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes card-pop {
  0% {
    transform: scale(0.8) translateY(20px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* 关闭按钮 */
.holiday-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s;
}

.holiday-close:active {
  background: rgba(0, 0, 0, 0.6);
}

.holiday-close svg {
  width: 16px;
  height: 16px;
}

/* 图片区 */
.holiday-card__image-wrap {
  position: relative;
  width: 100%;
  height: 180px;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000 40%));
}

.holiday-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.holiday-card__image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.3) 60%,
    rgba(0, 0, 0, 0.6) 100%
  );
}

.holiday-card__name-badge {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 16px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.holiday-card__name {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
}

.holiday-card__date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-variant-numeric: tabular-nums;
}

/* 内容区 */
.holiday-card__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 8px;
  -webkit-overflow-scrolling: touch;
}

.holiday-card__greeting {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-text-1);
  padding: 12px 14px;
  background: color-mix(in srgb, var(--accent) 8%, var(--color-bg-1));
  border-radius: 10px;
  border-left: 3px solid var(--accent);
}

.holiday-card__section {
  margin-bottom: 14px;
}

.holiday-card__section:last-child {
  margin-bottom: 0;
}

.holiday-card__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.holiday-card__section-icon {
  font-size: 14px;
}

.holiday-card__section-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-2);
}

/* 底部按钮 */
.holiday-card__footer {
  flex-shrink: 0;
  padding: 12px 18px calc(12px + var(--safe-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.holiday-card__btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 22px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s, opacity 0.2s;
}

.holiday-card__btn:active {
  transform: scale(0.96);
  opacity: 0.9;
}

/* 过渡动画 */
.holiday-fade-enter-active,
.holiday-fade-leave-active {
  transition: opacity 0.25s ease;
}

.holiday-fade-enter-active .holiday-card,
.holiday-fade-leave-active .holiday-card {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
}

.holiday-fade-enter-from,
.holiday-fade-leave-to {
  opacity: 0;
}

.holiday-fade-enter-from .holiday-card,
.holiday-fade-leave-to .holiday-card {
  transform: scale(0.85) translateY(20px);
  opacity: 0;
}
</style>
