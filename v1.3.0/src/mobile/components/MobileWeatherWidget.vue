<script setup lang="ts">
/**
 * 移动端天气组件
 * - 浏览器 Geolocation API 获取位置
 * - Open-Meteo 免费 API 获取天气（无需 key）
 * - 坐标缓存到 localStorage（10 分钟有效），避免 PWA 重开重复请求定位权限
 * - 定位失败时显示刷新按钮
 */
import { ref, onMounted } from 'vue'

interface WeatherData {
  temp: number
  code: number
  wind: number
  description: string
}

const LS_KEY = 'cleannotes_weather_coords'
const CACHE_MAX_AGE = 10 * 60 * 1000 // 10 分钟

// ── 天气码映射 ──
// Open-Meteo WMO codes: https://open-meteo.com/en/docs
const weatherMap: Record<number, { label: string; icon: string }> = {
  0:  { label: '晴',      icon: 'sun' },
  1:  { label: '少云',    icon: 'cloud-sun' },
  2:  { label: '多云',    icon: 'cloud' },
  3:  { label: '阴',      icon: 'cloud' },
  45: { label: '雾',      icon: 'fog' },
  48: { label: '雾凇',    icon: 'fog' },
  51: { label: '小雨',    icon: 'rain' },
  53: { label: '中雨',    icon: 'rain' },
  55: { label: '大雨',    icon: 'rain' },
  61: { label: '小雨',    icon: 'rain' },
  63: { label: '中雨',    icon: 'rain' },
  65: { label: '大雨',    icon: 'rain' },
  71: { label: '小雪',    icon: 'snow' },
  73: { label: '中雪',    icon: 'snow' },
  75: { label: '大雪',    icon: 'snow' },
  77: { label: '雪粒',    icon: 'snow' },
  80: { label: '阵雨',    icon: 'rain' },
  81: { label: '中阵雨',  icon: 'rain' },
  82: { label: '大阵雨',  icon: 'rain' },
  85: { label: '阵雪',    icon: 'snow' },
  86: { label: '大阵雪',  icon: 'snow' },
  95: { label: '雷暴',    icon: 'thunder' },
  96: { label: '雷暴+冰雹', icon: 'thunder' },
  99: { label: '强雷暴+冰雹', icon: 'thunder' },
}

const weather = ref<WeatherData | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const locationFailed = ref(false) // true 时显示刷新按钮

// ── localStorage 坐标缓存 ──
interface CachedCoords {
  lat: number
  lon: number
  ts: number
}

function readCachedCoords(): CachedCoords | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const c: CachedCoords = JSON.parse(raw)
    if (Date.now() - c.ts > CACHE_MAX_AGE) {
      localStorage.removeItem(LS_KEY)
      return null
    }
    return c
  } catch {
    return null
  }
}

function saveCachedCoords(lat: number, lon: number) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ lat, lon, ts: Date.now() }))
  } catch { /* quota exceeded, ignore */ }
}

// ── 获取天气 ──
async function fetchWeather(lat: number, lon: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const curr = data.current
    const code = curr.weather_code as number
    weather.value = {
      temp: Math.round(curr.temperature_2m),
      code,
      wind: Math.round(curr.wind_speed_10m),
      description: weatherMap[code]?.label ?? '未知',
    }
    errorMsg.value = ''
    locationFailed.value = false
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      errorMsg.value = '天气获取超时'
    } else {
      errorMsg.value = '天气不可用'
    }
  } finally {
    loading.value = false
  }
}

// ── 请求定位（优先缓存，避免重复弹权限） ──
function requestLocation() {
  if (!navigator.geolocation) {
    errorMsg.value = '位置不可用'
    loading.value = false
    locationFailed.value = true
    return
  }

  // 1. 优先使用 localStorage 缓存
  const cached = readCachedCoords()
  if (cached) {
    loading.value = false
    fetchWeather(cached.lat, cached.lon)
    return
  }

  // 2. 无缓存则请求定位
  loading.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords
      saveCachedCoords(latitude, longitude)
      fetchWeather(latitude, longitude)
    },
    () => {
      errorMsg.value = '定位失败'
      loading.value = false
      locationFailed.value = true
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
  )
}

onMounted(() => {
  requestLocation()
})

// ── 是否为下雨相关天气 ──
const isRainy = (code: number) => [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)
const isSnowy = (code: number) => [71, 73, 75, 77, 85, 86].includes(code)
</script>

<template>
  <div class="weather-widget" :class="{ 'weather-widget--loading': loading }">
    <template v-if="loading">
      <span class="weather-widget__placeholder">天气加载中</span>
    </template>
    <template v-else-if="errorMsg">
      <span class="weather-widget__error">{{ errorMsg }}</span>
      <button v-if="locationFailed" class="weather-widget__retry" @click="requestLocation" title="刷新定位">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
    </template>
    <template v-else-if="weather">
      <!-- 天气图标 -->
      <div class="weather-widget__icon">
        <!-- 下雨：动态雨滴 -->
        <svg v-if="isRainy(weather.code)" class="weather-svg weather-svg--rain" viewBox="0 0 40 40">
          <defs>
            <line id="raindrop" x1="20" y1="2" x2="20" y2="10" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" />
          </defs>
          <use href="#raindrop" class="rain-d1" />
          <use href="#raindrop" class="rain-d2" />
          <use href="#raindrop" class="rain-d3" />
          <use href="#raindrop" class="rain-d4" />
          <use href="#raindrop" class="rain-d5" />
          <!-- 云 -->
          <g opacity="0.7">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="26" cy="13" rx="9" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>

        <!-- 雪：动态雪花 -->
        <svg v-else-if="isSnowy(weather.code)" class="weather-svg weather-svg--snow" viewBox="0 0 40 40">
          <defs>
            <g id="snowflake">
              <circle cx="0" cy="0" r="2" fill="rgba(255,255,255,0.85)" />
            </g>
          </defs>
          <use href="#snowflake" class="snow-s1" />
          <use href="#snowflake" class="snow-s2" />
          <use href="#snowflake" class="snow-s3" />
          <use href="#snowflake" class="snow-s4" />
          <use href="#snowflake" class="snow-s5" />
          <use href="#snowflake" class="snow-s6" />
          <!-- 云 -->
          <g opacity="0.7">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="26" cy="13" rx="9" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>

        <!-- 雷暴 -->
        <svg v-else-if="weather.code >= 95" class="weather-svg weather-svg--thunder" viewBox="0 0 40 40">
          <polygon class="thunder-bolt" points="22,2 13,18 19,18 15,28 27,12 21,12" fill="rgba(255,220,60,0.9)" />
          <g opacity="0.6">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.25)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="28" cy="14" rx="9" ry="6" fill="rgba(255,255,255,0.3)" />
          </g>
        </svg>

        <!-- 多云 -->
        <svg v-else-if="weather.code >= 1 && weather.code <= 3" class="weather-svg" viewBox="0 0 40 40">
          <circle cx="14" cy="12" r="7" fill="rgba(255,255,255,0.7)" />
          <g v-if="weather.code >= 2" opacity="0.6">
            <ellipse cx="20" cy="20" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="14" cy="16" rx="9" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="27" cy="17" rx="8" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>

        <!-- 雾 -->
        <svg v-else-if="weather.code >= 45 && weather.code <= 48" class="weather-svg" viewBox="0 0 40 40">
          <line x1="6" y1="14" x2="34" y2="14" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" />
          <line x1="10" y1="20" x2="30" y2="20" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round" />
          <line x1="8" y1="26" x2="32" y2="26" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />
        </svg>

        <!-- 晴天（默认） -->
        <svg v-else class="weather-svg weather-svg--sun" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="9" fill="rgba(255,255,255,0.85)" />
          <g stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round">
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

      <!-- 温度 + 描述 -->
      <div class="weather-widget__info">
        <span class="weather-widget__temp">{{ weather.temp }}°</span>
        <span class="weather-widget__desc">{{ weather.description }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.weather-widget {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.weather-widget--loading {
  opacity: 0.6;
}

.weather-widget__placeholder,
.weather-widget__error {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.weather-widget__retry {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
  transition: background 0.15s, color 0.15s;
}

.weather-widget__retry:active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.weather-widget__retry svg {
  width: 14px;
  height: 14px;
}

/* ── 图标容器 ── */
.weather-widget__icon {
  width: 32px;
  height: 32px;
}

.weather-svg {
  width: 100%;
  height: 100%;
}

/* ── 雨天动画 ── */
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

/* ── 雪动画 ── */
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

/* ── 雷暴闪烁 ── */
.thunder-bolt {
  animation: thunderFlash 2s ease-in-out infinite;
}

@keyframes thunderFlash {
  0%, 90%, 100% { opacity: 0.2; }
  92%, 96% { opacity: 1; }
}

/* ── 太阳旋转 ── */
.weather-svg--sun {
  animation: sunSpin 12s linear infinite;
  transform-origin: center;
}

@keyframes sunSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── 文字信息 ── */
.weather-widget__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.weather-widget__temp {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.weather-widget__desc {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.65);
}
</style>
