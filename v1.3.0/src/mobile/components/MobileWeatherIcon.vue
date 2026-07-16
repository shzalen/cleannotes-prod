<script setup lang="ts">
/**
 * 动态天气图标组件
 * - 根据 WMO weather_code 渲染对应动画 SVG
 * - 尺寸可通过 CSS 控制（默认 100% 填满父容器）
 */
interface Props {
  code: number
}

const props = defineProps<Props>()

const isRainy = (code: number) => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)
const isSnowy = (code: number) => [71, 73, 75, 77, 85, 86].includes(code)
const isThunder = (code: number) => code >= 95
const isCloudy = (code: number) => code >= 1 && code <= 3
const isFoggy = (code: number) => code >= 45 && code <= 48
</script>

<template>
  <div class="weather-icon">
    <!-- 雨 -->
    <svg v-if="isRainy(code)" class="weather-svg weather-svg--rain" viewBox="0 0 40 40">
      <defs>
        <line id="raindrop" x1="20" y1="2" x2="20" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </defs>
      <use href="#raindrop" class="rain-d1" />
      <use href="#raindrop" class="rain-d2" />
      <use href="#raindrop" class="rain-d3" />
      <use href="#raindrop" class="rain-d4" />
      <use href="#raindrop" class="rain-d5" />
      <g opacity="0.7">
        <ellipse cx="20" cy="18" rx="14" ry="9" fill="currentColor" fill-opacity="0.35" />
        <ellipse cx="13" cy="14" rx="8" ry="7" fill="currentColor" fill-opacity="0.45" />
        <ellipse cx="26" cy="13" rx="9" ry="6" fill="currentColor" fill-opacity="0.4" />
      </g>
    </svg>

    <!-- 雪 -->
    <svg v-else-if="isSnowy(code)" class="weather-svg weather-svg--snow" viewBox="0 0 40 40">
      <defs>
        <g id="snowflake">
          <circle cx="0" cy="0" r="2" fill="currentColor" fill-opacity="0.85" />
        </g>
      </defs>
      <use href="#snowflake" class="snow-s1" />
      <use href="#snowflake" class="snow-s2" />
      <use href="#snowflake" class="snow-s3" />
      <use href="#snowflake" class="snow-s4" />
      <use href="#snowflake" class="snow-s5" />
      <use href="#snowflake" class="snow-s6" />
      <g opacity="0.7">
        <ellipse cx="20" cy="18" rx="14" ry="9" fill="currentColor" fill-opacity="0.35" />
        <ellipse cx="13" cy="14" rx="8" ry="7" fill="currentColor" fill-opacity="0.45" />
        <ellipse cx="26" cy="13" rx="9" ry="6" fill="currentColor" fill-opacity="0.4" />
      </g>
    </svg>

    <!-- 雷暴 -->
    <svg v-else-if="isThunder(code)" class="weather-svg weather-svg--thunder" viewBox="0 0 40 40">
      <polygon class="thunder-bolt" points="22,2 13,18 19,18 15,28 27,12 21,12" fill="rgba(255,220,60,0.95)" />
      <g opacity="0.6">
        <ellipse cx="20" cy="18" rx="14" ry="9" fill="currentColor" fill-opacity="0.25" />
        <ellipse cx="13" cy="14" rx="8" ry="7" fill="currentColor" fill-opacity="0.35" />
        <ellipse cx="28" cy="14" rx="9" ry="6" fill="currentColor" fill-opacity="0.3" />
      </g>
    </svg>

    <!-- 多云/阴 -->
    <svg v-else-if="isCloudy(code)" class="weather-svg weather-svg--cloud" viewBox="0 0 40 40">
      <circle cx="14" cy="12" r="7" fill="currentColor" fill-opacity="0.7" />
      <g opacity="0.6">
        <ellipse cx="20" cy="20" rx="14" ry="9" fill="currentColor" fill-opacity="0.35" />
        <ellipse cx="14" cy="16" rx="9" ry="7" fill="currentColor" fill-opacity="0.45" />
        <ellipse cx="27" cy="17" rx="8" ry="6" fill="currentColor" fill-opacity="0.4" />
      </g>
    </svg>

    <!-- 雾 -->
    <svg v-else-if="isFoggy(code)" class="weather-svg weather-svg--fog" viewBox="0 0 40 40">
      <line x1="6" y1="14" x2="34" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-opacity="0.4" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-opacity="0.35" />
      <line x1="8" y1="26" x2="32" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-opacity="0.3" />
    </svg>

    <!-- 晴（默认） -->
    <svg v-else class="weather-svg weather-svg--sun" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="9" fill="currentColor" fill-opacity="0.85" />
      <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.5">
        <line x1="20" y1="2" x2="20" y2="8" />
        <line x1="20" y1="32" x2="20" y2="38" />
        <line x1="2" y1="20" x2="8" y2="20" />
        <line x1="32" y1="20" x2="38" y2="20" />
        <line x1="7" y1="7" x2="12" y2="12" />
        <line x1="28" y1="28" x2="33" y2="33" />
        <line x1="33" y1="7" x2="28" y2="12" />
        <line x1="12" y1="28" x2="7" y2="33" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.weather-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weather-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  color: inherit;
}

/* 雨滴动画 */
.rain-d1, .rain-d2, .rain-d3, .rain-d4, .rain-d5 {
  animation: rainFall var(--rd, 0.6s) linear infinite;
  opacity: 0;
}
.rain-d1 { --rd: 0.55s; animation-delay: 0s; }
.rain-d2 { --rd: 0.48s; animation-delay: 0.12s; }
.rain-d3 { --rd: 0.62s; animation-delay: 0.25s; }
.rain-d4 { --rd: 0.5s;  animation-delay: 0.38s; }
.rain-d5 { --rd: 0.57s; animation-delay: 0.45s; }

@keyframes rainFall {
  0%   { transform: translate(0, -4px); opacity: 0; }
  15%  { opacity: 0.9; }
  85%  { opacity: 0.3; }
  100% { transform: translate(0, 24px); opacity: 0; }
}

/* 雪花动画 */
.snow-s1, .snow-s2, .snow-s3, .snow-s4, .snow-s5, .snow-s6 {
  animation: snowFall var(--sd, 2s) linear infinite;
  opacity: 0;
}
.snow-s1 { --sd: 2.2s; animation-delay: 0s; }
.snow-s2 { --sd: 1.8s; animation-delay: 0.4s; }
.snow-s3 { --sd: 2.5s; animation-delay: 0.8s; }
.snow-s4 { --sd: 2.0s; animation-delay: 1.2s; }
.snow-s5 { --sd: 1.9s; animation-delay: 0.6s; }
.snow-s6 { --sd: 2.3s; animation-delay: 1.6s; }

@keyframes snowFall {
  0%   { transform: translate(0, -6px) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.8; }
  90%  { opacity: 0.2; }
  100% { transform: translate(4px, 28px) rotate(180deg); opacity: 0; }
}

/* 雷电动画 */
.thunder-bolt {
  animation: thunderFlash 2s ease-in-out infinite;
}

@keyframes thunderFlash {
  0%, 90%, 100% { opacity: 0.2; }
  92%, 96% { opacity: 1; }
}

/* 太阳旋转 */
.weather-svg--sun {
  animation: sunSpin 12s linear infinite;
  transform-origin: center;
}

@keyframes sunSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* 云朵轻微浮动 */
.weather-svg--cloud {
  animation: cloudFloat 4s ease-in-out infinite alternate;
}

@keyframes cloudFloat {
  from { transform: translateY(0); }
  to   { transform: translateY(-2px); }
}

/* 雾横向漂移 */
.weather-svg--fog {
  animation: fogDrift 5s ease-in-out infinite alternate;
}

@keyframes fogDrift {
  from { transform: translateX(-1px); }
  to   { transform: translateX(1px); }
}
</style>
