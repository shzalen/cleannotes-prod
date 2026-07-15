<script setup lang="ts">
/**
 * 移动端天气组件
 * - 浏览器 Geolocation API 获取位置
 * - Open-Meteo 免费 API 获取天气（无需 key）
 * - 坐标缓存到 localStorage（10 分钟有效），避免 PWA 重开重复请求定位权限
 * - 定位失败时显示刷新按钮
 * - 点击成功天气 → 弹窗显示 定位详情 + 近 7 天预报
 */
import { ref, computed, onMounted } from 'vue'
import { Popup as VanPopup } from 'vant'

interface WeatherData {
  temp: number
  code: number
  wind: number
  description: string
}

interface DailyForecast {
  date: string          // YYYY-MM-DD
  dayLabel: string      // "周一"
  dayNum: string        // "7/15"
  tempMax: number
  tempMin: number
  code: number
  description: string
  isToday: boolean
}

const LS_KEY = 'cleannotes_weather_coords'
const CACHE_MAX_AGE = 10 * 60 * 1000

// ── 天气码映射 ──
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
const locationFailed = ref(false)
const currentLat = ref(0)
const currentLon = ref(0)

// ── 详情弹窗 ──
const showDetail = ref(false)
const refreshing = ref(false)
const dailyForecast = ref<DailyForecast[]>([])
const forecastLoading = ref(false)
const detailAddress = ref('')
const addressLoading = ref(false)

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
  } catch { /* quota exceeded */ }
}

// ── 获取实时天气 ──
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
    currentLat.value = lat
    currentLon.value = lon
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

// ── 请求定位 ──
function requestLocation() {
  if (!navigator.geolocation) {
    errorMsg.value = '位置不可用'
    loading.value = false
    locationFailed.value = true
    return
  }

  const cached = readCachedCoords()
  if (cached) {
    loading.value = false
    fetchWeather(cached.lat, cached.lon)
    return
  }

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

// ── 天气图标判断 ──
const isRainy = (code: number) => [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)
const isSnowy = (code: number) => [71, 73, 75, 77, 85, 86].includes(code)

// ── 展开详情弹窗 ──
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

async function openDetail() {
  if (!weather.value || !currentLat.value) return
  showDetail.value = true
  // 并行请求
  fetchForecast()
  reverseGeocode()
}

// ── 获取 7 天预报 ──
async function fetchForecast() {
  if (dailyForecast.value.length > 0) return // 已缓存
  forecastLoading.value = true
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat.value.toFixed(4)}&longitude=${currentLon.value.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const daily = data.daily
    const todayStr = new Date().toISOString().slice(0, 10)

    dailyForecast.value = daily.time.map((date: string, i: number) => {
      const d = new Date(date + 'T12:00:00')
      const month = d.getMonth() + 1
      const dayNum = d.getDate()
      const isToday = date === todayStr
      const code = daily.weather_code[i] as number
      return {
        date,
        dayLabel: isToday ? '今天' : `周${weekDays[d.getDay()]}`,
        dayNum: `${month}/${dayNum}`,
        tempMax: Math.round(daily.temperature_2m_max[i]),
        tempMin: Math.round(daily.temperature_2m_min[i]),
        code,
        description: weatherMap[code]?.label ?? '未知',
        isToday,
      }
    })
  } catch {
    // 预报失败不阻塞弹窗
  } finally {
    forecastLoading.value = false
  }
}

// ── 逆地理编码 ──
async function reverseGeocode() {
  if (detailAddress.value) return // 已缓存
  addressLoading.value = true
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat.value.toFixed(5)}&lon=${currentLon.value.toFixed(5)}&zoom=12&accept-language=zh`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'CleanNotes-PWA/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    detailAddress.value = data.display_name || '未知位置'
  } catch {
    detailAddress.value = ''
  } finally {
    addressLoading.value = false
  }
}

// ── 刷新全部（定位 + 天气 + 预报 + 地址） ──
async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  // 清除所有缓存
  localStorage.removeItem(LS_KEY)
  dailyForecast.value = []
  detailAddress.value = ''
  // 重新请求定位（会触发天气刷新）
  requestLocation()
  // 并行请求预报和逆地理
  await Promise.allSettled([fetchForecast(), reverseGeocode()])
  refreshing.value = false
}

// ── 天气小图标 SVG ──
function getSmallWeatherIcon(code: number): string {
  const desc = weatherMap[code]?.label ?? ''
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  if (code === 0) return '☀️'
  if (code === 1) return '🌤️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if ([45, 48].includes(code)) return '🌫️'
  return '🌡️'
}
</script>

<template>
  <div
    class="weather-widget"
    :class="{ 'weather-widget--loading': loading, 'weather-widget--tappable': !!weather }"
    @click="weather ? openDetail() : undefined"
  >
    <template v-if="loading">
      <span class="weather-widget__placeholder">天气加载中</span>
    </template>
    <template v-else-if="errorMsg">
      <span class="weather-widget__error">{{ errorMsg }}</span>
      <button v-if="locationFailed" class="weather-widget__retry" @click.stop="requestLocation" title="刷新定位">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
    </template>
    <template v-else-if="weather">
      <!-- 天气图标 -->
      <div class="weather-widget__icon">
        <svg v-if="isRainy(weather.code)" class="weather-svg weather-svg--rain" viewBox="0 0 40 40">
          <defs>
            <line id="raindrop" x1="20" y1="2" x2="20" y2="10" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" />
          </defs>
          <use href="#raindrop" class="rain-d1" />
          <use href="#raindrop" class="rain-d2" />
          <use href="#raindrop" class="rain-d3" />
          <use href="#raindrop" class="rain-d4" />
          <use href="#raindrop" class="rain-d5" />
          <g opacity="0.7">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="26" cy="13" rx="9" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>
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
          <g opacity="0.7">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="26" cy="13" rx="9" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>
        <svg v-else-if="weather.code >= 95" class="weather-svg weather-svg--thunder" viewBox="0 0 40 40">
          <polygon class="thunder-bolt" points="22,2 13,18 19,18 15,28 27,12 21,12" fill="rgba(255,220,60,0.9)" />
          <g opacity="0.6">
            <ellipse cx="20" cy="18" rx="14" ry="9" fill="rgba(255,255,255,0.25)" />
            <ellipse cx="13" cy="14" rx="8" ry="7" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="28" cy="14" rx="9" ry="6" fill="rgba(255,255,255,0.3)" />
          </g>
        </svg>
        <svg v-else-if="weather.code >= 1 && weather.code <= 3" class="weather-svg" viewBox="0 0 40 40">
          <circle cx="14" cy="12" r="7" fill="rgba(255,255,255,0.7)" />
          <g v-if="weather.code >= 2" opacity="0.6">
            <ellipse cx="20" cy="20" rx="14" ry="9" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="14" cy="16" rx="9" ry="7" fill="rgba(255,255,255,0.45)" />
            <ellipse cx="27" cy="17" rx="8" ry="6" fill="rgba(255,255,255,0.4)" />
          </g>
        </svg>
        <svg v-else-if="weather.code >= 45 && weather.code <= 48" class="weather-svg" viewBox="0 0 40 40">
          <line x1="6" y1="14" x2="34" y2="14" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" />
          <line x1="10" y1="20" x2="30" y2="20" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round" />
          <line x1="8" y1="26" x2="32" y2="26" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />
        </svg>
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
      <div class="weather-widget__info">
        <span class="weather-widget__temp">{{ weather.temp }}°</span>
        <span class="weather-widget__desc">{{ weather.description }}</span>
      </div>
    </template>

    <!-- ── 天气详情弹窗 ── -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ background: 'var(--color-surface)', maxHeight: '80vh' }"
      teleport="body"
    >
      <div class="weather-detail">
        <!-- 拖动条 + 刷新按钮 -->
        <div class="weather-detail__header">
          <div class="weather-detail__handle">
            <div class="weather-detail__handle-bar" />
          </div>
          <button
            class="weather-detail__refresh"
            :class="{ 'weather-detail__refresh--spinning': refreshing }"
            :disabled="refreshing"
            @click="refreshAll"
            title="刷新定位和天气"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>

        <!-- A 区块：定位信息 -->
        <div class="weather-detail__section">
          <h3 class="weather-detail__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="weather-detail__title-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            当前位置
          </h3>
          <div class="weather-detail__location">
            <template v-if="addressLoading">
              <span class="weather-detail__loc-loading">获取地址中…</span>
            </template>
            <template v-else-if="detailAddress">
              <p class="weather-detail__loc-text">{{ detailAddress }}</p>
            </template>
            <template v-else>
              <p class="weather-detail__loc-text weather-detail__loc-text--fallback">无法获取详细地址</p>
            </template>
            <p class="weather-detail__coords">{{ currentLat.toFixed(4) }}, {{ currentLon.toFixed(4) }}</p>
          </div>
        </div>

        <!-- B 区块：7 天预报 -->
        <div class="weather-detail__section">
          <h3 class="weather-detail__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="weather-detail__title-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            近 7 天预报
          </h3>

          <template v-if="forecastLoading">
            <div class="weather-detail__fc-loading">加载预报中…</div>
          </template>
          <template v-else-if="dailyForecast.length > 0">
            <div class="weather-detail__fc-list">
              <!-- 今天：使用实时观测数据，与首页保持一致 -->
              <div
                v-if="weather"
                class="fc-card fc-card--today"
              >
                <div class="fc-card__day">
                  <span class="fc-card__label">今天</span>
                  <span class="fc-card__date">{{ new Date().getMonth() + 1 }}/{{ new Date().getDate() }}</span>
                </div>
                <span class="fc-card__icon">{{ getSmallWeatherIcon(weather.code) }}</span>
                <div class="fc-card__temps">
                  <span class="fc-card__high">{{ weather.temp }}°</span>
                  <span class="fc-card__sep">/</span>
                  <span class="fc-card__low">--</span>
                </div>
                <span class="fc-card__desc">{{ weather.description }}</span>
              </div>
              <!-- 后续 6 天：使用 daily forecast -->
              <div
                v-for="day in dailyForecast.filter(d => !d.isToday)"
                :key="day.date"
                class="fc-card"
              >
                <div class="fc-card__day">
                  <span class="fc-card__label">{{ day.dayLabel }}</span>
                  <span class="fc-card__date">{{ day.dayNum }}</span>
                </div>
                <span class="fc-card__icon">{{ getSmallWeatherIcon(day.code) }}</span>
                <div class="fc-card__temps">
                  <span class="fc-card__high">{{ day.tempMax }}°</span>
                  <span class="fc-card__sep">/</span>
                  <span class="fc-card__low">{{ day.tempMin }}°</span>
                </div>
                <span class="fc-card__desc">{{ day.description }}</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="weather-detail__fc-empty">预报数据暂不可用</div>
          </template>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
/* ── Widget 本体 ── */
.weather-widget {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.weather-widget--loading {
  opacity: 0.6;
}

.weather-widget--tappable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
  user-select: none;
}

.weather-widget--tappable:active {
  opacity: 0.7;
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

/* ── 图标 ── */
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

/* ══════════════════════════════════════════════════════════════
   详情弹窗
   ══════════════════════════════════════════════════════════════ */

.weather-detail {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.weather-detail__header {
  display: flex;
  align-items: center;
  position: relative;
  padding: 10px 0 4px;
}

.weather-detail__handle {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0;
}

.weather-detail__handle-bar {
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
}

.weather-detail__refresh {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.weather-detail__refresh svg {
  width: 18px;
  height: 18px;
}

.weather-detail__refresh:active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.weather-detail__refresh:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.weather-detail__refresh--spinning svg {
  animation: refreshSpin 0.8s linear infinite;
}

@keyframes refreshSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.weather-detail__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.weather-detail__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.weather-detail__title-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
}

/* ── A 区块：定位信息 ── */
.weather-detail__location {
  background: var(--color-bg-3);
  border-radius: 10px;
  padding: 12px 14px;
}

.weather-detail__loc-loading {
  font-size: 13px;
  color: var(--color-text-3);
}

.weather-detail__loc-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text-1);
  word-break: break-word;
}

.weather-detail__loc-text--fallback {
  color: var(--color-text-3);
  font-style: italic;
}

.weather-detail__coords {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--color-text-4);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

/* ── B 区块：7 天预报 ── */
.weather-detail__fc-loading,
.weather-detail__fc-empty {
  font-size: 13px;
  color: var(--color-text-3);
  padding: 8px 0;
  text-align: center;
}

.weather-detail__fc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fc-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--color-bg-3);
  transition: background 0.15s;
}

.fc-card--today {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-3));
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.fc-card__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.fc-card__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
}

.fc-card__date {
  font-size: 10px;
  color: var(--color-text-3);
  margin-top: 1px;
}

.fc-card__icon {
  font-size: 20px;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.fc-card__temps {
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  min-width: 52px;
  text-align: center;
}

.fc-card__high {
  color: var(--color-text-1);
}

.fc-card__sep {
  color: var(--color-text-4);
  margin: 0 1px;
}

.fc-card__low {
  color: var(--color-text-3);
}

.fc-card__desc {
  font-size: 12px;
  color: var(--color-text-2);
  margin-left: auto;
}
</style>
