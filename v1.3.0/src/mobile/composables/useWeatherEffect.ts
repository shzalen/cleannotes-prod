/**
 * 天气数据共享 composable
 * MobileWeatherWidget 获取天气后通过 setWeather 更新，
 * MobileHome 读取 weatherEffect 来驱动头部沉浸式特效。
 */

export type WeatherEffect = 'default' | 'sun' | 'cloud' | 'rain' | 'snow' | 'thunder' | 'night'

import { ref, computed } from 'vue'

const weatherCode = ref<number | null>(null)

/** 将 Open-Meteo weather code 映射为特效类型 */
function codeToEffect(code: number): WeatherEffect {
  const hour = new Date().getHours()
  const isNight = hour >= 19 || hour < 6

  // 晴 + 夜晚 → night
  if (code === 0 || code === 1) {
    return isNight ? 'night' : 'sun'
  }
  // 少云/多云/阴
  if (code === 2 || code === 3) return 'cloud'
  // 雾
  if (code === 45 || code === 48) return 'cloud'
  // 雨
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rain'
  // 雪
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  // 雷暴
  if ([95, 96, 99].includes(code)) return 'thunder'

  return 'default'
}

export function useWeatherEffect() {
  const weatherEffect = computed<WeatherEffect>(() => {
    if (weatherCode.value === null) return 'default'
    return codeToEffect(weatherCode.value)
  })

  function setWeather(code: number | null) {
    weatherCode.value = code
  }

  return { weatherEffect, setWeather }
}
