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
import MobileWeatherIcon from './MobileWeatherIcon.vue'
import { useWeatherEffect } from '../composables/useWeatherEffect'

const { setWeather } = useWeatherEffect()

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

// ── 天气码映射（WMO Weather interpretation codes） ──
// 参考: https://open-meteo.com/en/docs (WMO 标准码)
// 注意：WMO 标准与 Apple Weather 使用的 The Weather Channel 码不同，
// Apple Weather 实际看到的是经过转换的描述，这里按 WMO 官方语义映射。
const weatherMap: Record<number, { label: string; icon: string }> = {
  0:  { label: '晴',      icon: 'sun' },
  1:  { label: '晴间多云', icon: 'cloud-sun' },   // Mainly clear
  2:  { label: '多云',    icon: 'cloud' },        // Partly cloudy
  3:  { label: '阴',      icon: 'cloud' },        // Overcast
  45: { label: '雾',      icon: 'fog' },          // Fog
  48: { label: '雾凇',    icon: 'fog' },          // Depositing rime fog
  51: { label: '毛毛雨',  icon: 'rain' },         // Light drizzle
  53: { label: '毛毛雨',  icon: 'rain' },         // Moderate drizzle
  55: { label: '毛毛雨',  icon: 'rain' },         // Dense drizzle
  56: { label: '冻毛毛雨', icon: 'rain' },         // Light freezing drizzle
  57: { label: '冻毛毛雨', icon: 'rain' },         // Dense freezing drizzle
  61: { label: '小雨',    icon: 'rain' },          // Slight rain
  63: { label: '中雨',    icon: 'rain' },          // Moderate rain
  65: { label: '大雨',    icon: 'rain' },          // Heavy rain
  66: { label: '冻雨',    icon: 'rain' },          // Light freezing rain
  67: { label: '冻雨',    icon: 'rain' },          // Heavy freezing rain
  71: { label: '小雪',    icon: 'snow' },
  73: { label: '中雪',    icon: 'snow' },
  75: { label: '大雪',    icon: 'snow' },
  77: { label: '雪粒',    icon: 'snow' },          // Snow grains
  80: { label: '阵雨',    icon: 'rain' },          // Slight rain showers
  81: { label: '中阵雨',  icon: 'rain' },
  82: { label: '大阵雨',  icon: 'rain' },
  85: { label: '阵雪',    icon: 'snow' },
  86: { label: '大阵雪',  icon: 'snow' },
  95: { label: '雷暴',    icon: 'thunder' },
  96: { label: '雷暴伴冰雹', icon: 'thunder' },
  99: { label: '强雷暴伴冰雹', icon: 'thunder' },
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
    // 共享天气 code 给首页头部沉浸式特效
    setWeather(code)
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
function requestLocation(): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) {
    errorMsg.value = '位置不可用'
    loading.value = false
    locationFailed.value = true
    return Promise.resolve(null)
  }

  const cached = readCachedCoords()
  if (cached) {
    loading.value = false
    fetchWeather(cached.lat, cached.lon)
    return Promise.resolve({ lat: cached.lat, lon: cached.lon })
  }

  loading.value = true
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        saveCachedCoords(latitude, longitude)
        fetchWeather(latitude, longitude)
        resolve({ lat: latitude, lon: longitude })
      },
      () => {
        errorMsg.value = '定位失败'
        loading.value = false
        locationFailed.value = true
        resolve(null)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    )
  })
}

onMounted(() => {
  requestLocation()
})

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

// ── 繁体→简体转换（覆盖中国地理地址常见繁体字） ──
const t2sMap: Record<string, string> = {
  '廣':'广','東':'东','區':'区','縣':'县','鎮':'镇','鄉':'乡','灣':'湾','關':'关',
  '陽':'阳','陰':'阴','開':'开','門':'门','華':'华','國':'国','學':'学','車':'车',
  '馬':'马','龍':'龙','鳳':'凤','鳥':'鸟','魚':'鱼','島':'岛','嶺':'岭','峽':'峡',
  '橋':'桥','頭':'头','邊':'边','連':'连','遠':'远','達':'达','進':'进','遲':'迟',
  '運':'运','過':'过','適':'适','選':'选','鄭':'郑','趙':'赵','劉':'刘','陳':'陈',
  '楊':'杨','黃':'黄','吳':'吴','張':'张','葉':'叶','謝':'谢','萬':'万','賴':'赖',
  '蘇':'苏','豐':'丰','鐘':'钟','蕭':'萧','蔣':'蒋','羅':'罗','許':'许','韓':'韩',
  '鄧':'邓','馮':'冯','譚':'谭','鄒':'邹','顧':'顾','顏':'颜','龔':'龚','龐':'庞',
  '歐':'欧','倫':'伦','強':'强','樓':'楼','藍':'蓝','簡':'简','習':'习','應':'应',
  '盧':'卢','閆':'闫','瓊':'琼','蘭':'兰','銀':'银','烏':'乌','魯':'鲁','齊':'齐',
  '爾':'尔','濱':'滨','長':'长','遼':'辽','鐵':'铁','盤':'盘','錦':'锦','蘆':'芦',
  '營':'营','撫':'抚','順':'顺','慶':'庆','綏':'绥','雙':'双','鴨':'鸭','興':'兴',
  '鶴':'鹤','崗':'岗','額':'额','納':'纳','霍':'霍','勒':'勒','錫':'锡','穆':'穆',
  '沁':'沁','鑲':'镶','涼':'凉','察':'察','翼':'翼','後':'后','卓':'卓','資':'资',
  '寧':'宁','臨':'临','審':'审','洛':'洛','滄':'沧','潁':'颍','澤':'泽','滙':'汇',
  '榮':'荣','嶧':'峄','嶗':'崂','嶴':'岙','嶠':'峤','嶢':'峣','嶨':'岘','嶸':'嵘',
  '巒':'峦','巔':'巅','巖':'岩','參':'参','叢':'丛','厲':'厉','嚴':'严','厭':'厌',
  '厰':'厂','場':'场','壩':'坝','塊':'块','堅':'坚','壇':'坛','壟':'垄','壯':'壮',
  '壺':'壶','壽':'寿','夢':'梦','夾':'夹','奐':'奂','奧':'奥','奩':'奁','妝':'妆',
  '媧':'娲','嫗':'妪','嬰':'婴','嬸':'婶','孫':'孙','孿':'孪','宮':'宫','寬':'宽',
  '賓':'宾','寵':'宠','寶':'宝','實':'实','專':'专','尋':'寻','對':'对','導':'导',
  '將':'将','層':'层','屢':'屡','屬':'属','嶼':'屿','幣':'币','幹':'干','彌':'弥',
  '彎':'弯','彙':'汇','徹':'彻','徵':'征','懷':'怀','懶':'懒','戲':'戏','戶':'户',
  '拋':'抛','據':'据','擋':'挡','擠':'挤','揮':'挥','搖':'摇','搗':'捣','換':'换',
  '搶':'抢','掃':'扫','揚':'扬','擊':'击','擱':'搁','擲':'掷','擴':'扩','擺':'摆',
  '攏':'拢','攔':'拦','攬':'揽','攜':'携','攝':'摄','攣':'挛','攤':'摊','敗':'败',
  '敘':'叙','斂':'敛','斃':'毙','敵':'敌','數':'数','斷':'断','時':'时','舊':'旧',
  '書':'书','機':'机','殺':'杀','雜':'杂','權':'权','欄':'栏','樹':'树','桿':'杆',
  '條':'条','來':'来','楓':'枫','極':'极','樞':'枢','橫':'横','櫃':'柜','櫻':'樱',
  '欒':'栾','歡':'欢','歲':'岁','歸':'归','歷':'历','殘':'残','殤':'殇','殞':'殒',
  '毀':'毁','毆':'殴','氣':'气','氫':'氢','氬':'氩','沒':'没','沖':'冲',' 泥':'泥',
}

function toSimplifiedChinese(text: string): string {
  if (!text) return text
  let result = ''
  for (const ch of text) {
    result += t2sMap[ch] || ch
  }
  return result
}

// ── 逆地理编码（带 fallback） ──
async function reverseGeocode() {
  if (detailAddress.value) return // 已缓存
  if (!currentLat.value || !currentLon.value) return
  addressLoading.value = true

  const lat = currentLat.value
  const lon = currentLon.value

  // fallback 链：优先 BigDataCloud（返回简体中文），失败则用 Nominatim（可能返回繁体，需转换）
  async function bigDataCloud(): Promise<string | null> {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}&localityLanguage=zh`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const parts: string[] = []
    if (data.principalSubdivision) parts.push(data.principalSubdivision)
    if (data.city) parts.push(data.city)
    if (data.locality) parts.push(data.locality)
    return parts.length ? parts.join('，') : null
  }

  async function nominatim(): Promise<string | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=12&accept-language=zh-CN`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'CleanNotes-PWA/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.display_name || null
  }

  try {
    let address: string | null = null
    try {
      address = await bigDataCloud()
    } catch {
      address = await nominatim()
    }
    // 繁体转简体兜底（主要针对 Nominatim 返回的繁体地址）
    detailAddress.value = address ? toSimplifiedChinese(address) : '未知位置'
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
  // 重新请求定位并等待坐标就绪
  const coords = await requestLocation()
  if (coords) {
    // 并行请求预报和逆地理
    await Promise.allSettled([fetchForecast(), reverseGeocode()])
  }
  refreshing.value = false
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
        <MobileWeatherIcon :code="weather.code" />
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
        <!-- 固定区域：拖动条 + 当前天气大图标（不随内容滚动） -->
        <div class="weather-detail__fixed">
          <div class="weather-detail__header">
            <div class="weather-detail__handle">
              <div class="weather-detail__handle-bar" />
            </div>
          </div>

          <div v-if="weather" class="weather-detail__now">
            <div class="weather-detail__now-icon">
              <MobileWeatherIcon :code="weather.code" />
            </div>
            <div class="weather-detail__now-info">
              <span class="weather-detail__now-temp">{{ weather.temp }}°</span>
              <span class="weather-detail__now-desc">{{ weather.description }}</span>
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
        </div>

        <!-- 可滚动区域：定位信息 + 7 天预报 -->
        <div class="weather-detail__scroll">
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
                <span class="weather-detail__loc-text">{{ detailAddress }}</span>
              </template>
              <template v-else>
                <span class="weather-detail__loc-text weather-detail__loc-text--fallback">无法获取详细地址</span>
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

            <!-- 预报列表：始终保留 7 行占位，避免加载前后高度跳变 -->
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
                <span class="fc-card__icon"><MobileWeatherIcon :code="weather.code" /></span>
                <div class="fc-card__temps">
                  <span class="fc-card__high">{{ weather.temp }}°</span>
                  <span class="fc-card__sep">/</span>
                  <span class="fc-card__low">--</span>
                </div>
                <span class="fc-card__desc">{{ weather.description }}</span>
              </div>
              <!-- 后续 6 天：使用 daily forecast -->
              <template v-if="forecastLoading">
                <div v-for="n in 6" :key="'skeleton-' + n" class="fc-card fc-card--skeleton">
                  <div class="fc-card__day">
                    <span class="fc-card__label fc-card__skeleton-text" />
                    <span class="fc-card__date fc-card__skeleton-text" />
                  </div>
                  <span class="fc-card__icon fc-card__skeleton-icon" />
                  <div class="fc-card__temps">
                    <span class="fc-card__skeleton-text" />
                  </div>
                  <span class="fc-card__desc fc-card__skeleton-text" />
                </div>
              </template>
              <template v-else-if="dailyForecast.length > 0">
                <div
                  v-for="day in dailyForecast.filter(d => !d.isToday)"
                  :key="day.date"
                  class="fc-card"
                >
                  <div class="fc-card__day">
                    <span class="fc-card__label">{{ day.dayLabel }}</span>
                    <span class="fc-card__date">{{ day.dayNum }}</span>
                  </div>
                  <span class="fc-card__icon"><MobileWeatherIcon :code="day.code" /></span>
                  <div class="fc-card__temps">
                    <span class="fc-card__high">{{ day.tempMax }}°</span>
                    <span class="fc-card__sep">/</span>
                    <span class="fc-card__low">{{ day.tempMin }}°</span>
                  </div>
                  <span class="fc-card__desc">{{ day.description }}</span>
                </div>
              </template>
              <template v-else>
                <div class="fc-card fc-card--empty">
                  <span class="fc-card__desc">预报数据暂不可用</span>
                </div>
              </template>
            </div>
          </div>
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
  color: rgba(255, 255, 255, 0.92);
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
  max-height: 80vh;
  overflow: hidden;
}

/* 固定区域：拖动条 + 天气大图标（不随内容滚动） */
.weather-detail__fixed {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
}

/* 可滚动区域：定位信息 + 7 天预报 */
.weather-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 20px;
}

.weather-detail__header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 4px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}

.weather-detail__refresh svg {
  width: 20px;
  height: 20px;
}

.weather-detail__refresh:active {
  color: var(--color-primary);
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

/* ── 当前天气大图标展示 ── */
.weather-detail__now {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0 16px;
}

.weather-detail__now-icon {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  color: var(--color-primary);
}

.weather-detail__now-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.weather-detail__now-temp {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}

.weather-detail__now-desc {
  font-size: 14px;
  color: var(--color-text-2);
  margin-top: 2px;
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
  width: 32px;
  height: 32px;
  text-align: center;
  flex-shrink: 0;
  color: var(--color-text-2);
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

/* ── 骨架屏占位（加载中保持高度） ── */
.fc-card--skeleton {
  pointer-events: none;
}

.fc-card__skeleton-text {
  display: inline-block;
  height: 12px;
  min-width: 28px;
  border-radius: 4px;
  background: var(--color-border-light);
  animation: skeletonPulse 1.2s ease-in-out infinite;
}

.fc-card__skeleton-text.fc-card__label {
  min-width: 32px;
  height: 13px;
}

.fc-card__skeleton-text.fc-card__date {
  min-width: 24px;
  height: 10px;
  margin-top: 1px;
}

.fc-card__skeleton-text.fc-card__desc {
  min-width: 24px;
  height: 12px;
  margin-left: auto;
}

.fc-card__skeleton-icon {
  background: var(--color-border-light);
  border-radius: 6px;
  animation: skeletonPulse 1.2s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.fc-card--empty {
  justify-content: center;
  text-align: center;
}

.fc-card--empty .fc-card__desc {
  margin: 0 auto;
}
</style>
