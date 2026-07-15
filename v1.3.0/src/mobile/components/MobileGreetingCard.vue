<script setup lang="ts">
/**
 * 移动端问候卡片 — 日期 + 随机激励语 + 天气
 * 问候语已移至首页头部标题栏
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isOnline } from '@/services/storage'
import MobileWeatherWidget from './MobileWeatherWidget.vue'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 60000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function getDayInfo(d: Date) {
  const day = d.getDay()
  const month = d.getMonth() + 1
  const date = d.getDate()
  const isWeekend = day === 0 || day === 6
  const holidays: [number, number, string][] = [
    [1, 1, '元旦'], [2, 14, '情人节'], [3, 8, '妇女节'],
    [4, 5, '清明节'], [5, 1, '劳动节'], [5, 4, '青年节'],
    [6, 1, '儿童节'], [9, 10, '教师节'], [10, 1, '国庆节'],
    [10, 31, '万圣节'], [12, 25, '圣诞节'],
  ]
  const holiday = holidays.find(([m, dd]) => m === month && dd === date)
  return { isWeekend, holiday: holiday?.[2] || null }
}

const dayInfo = computed(() => getDayInfo(now.value))

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const dateStr = computed(() => {
  const d = now.value
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const weekNum = getISOWeekNumber(d)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]} · 第${weekNum}周`
})

const quote = computed(() => {
  if (!isOnline.value) return '离线模式中，数据保存于本地'

  const h = now.value.getHours()
  const { isWeekend, holiday } = dayInfo.value

  if (holiday) {
    const holidayQuotes = [
      `🎉 ${holiday}快乐！享受美好时光吧。`,
      `${holiday}快乐！今天给自己放个假。`,
      `今天是${holiday}，别忘了犒劳自己。`,
    ]
    return holidayQuotes[Math.floor(Math.random() * holidayQuotes.length)]
  }

  if (isWeekend) {
    const weekendQuotes = [
      '周末愉快！好好休息，下周更有力。',
      '休息是为了走更远的路。',
      '周末也值得被认真对待。',
      '充电时间到，享受当下。',
    ]
    return weekendQuotes[h % weekendQuotes.length]
  }

  if (h < 6) {
    const nightQuotes = ['夜深了，早点休息吧。', '熬夜伤身，注意身体。', '月色正好，但睡眠更重要。']
    return nightQuotes[now.value.getMinutes() % nightQuotes.length]
  }
  if (h < 9) {
    const morningQuotes = ['早起的鸟儿有虫吃，新的一天开始了。', '清晨的时光最宝贵，抓住每一分钟。', '新的早晨，新的可能，全力以赴。']
    return morningQuotes[now.value.getMinutes() % morningQuotes.length]
  }
  if (h < 12) {
    const amQuotes = ['专注当下，高效产出。', '保持节奏，稳步推进。', '每一步都算数，坚持就是胜利。']
    return amQuotes[now.value.getMinutes() % amQuotes.length]
  }
  if (h < 14) {
    const noonQuotes = ['午间充电，下午更有劲。', '适当休息，才能持续高效。']
    return noonQuotes[now.value.getMinutes() % noonQuotes.length]
  }
  if (h < 18) {
    const pmQuotes = ['坚持输出，量变引发质变。', '不积跬步，无以至千里。', '今日事，今日毕。', '离下班又近了一步，加油！']
    return pmQuotes[now.value.getMinutes() % pmQuotes.length]
  }

  const eveningQuotes = ['今天的努力，明天会感谢自己。', '复盘今天，规划明天。', '充实的一天，值得好好休息。']
  return eveningQuotes[now.value.getMinutes() % eveningQuotes.length]
})
</script>

<template>
  <div class="m-greeting">
    <div class="m-greeting__row">
      <div class="m-greeting__main">
        <span v-if="dayInfo.holiday" class="m-greeting__badge m-greeting__badge--holiday">{{ dayInfo.holiday }}</span>
        <span v-else-if="dayInfo.isWeekend" class="m-greeting__badge m-greeting__badge--weekend">周末</span>
        <span v-if="!isOnline" class="m-greeting__badge m-greeting__badge--offline">离线</span>
      </div>
      <MobileWeatherWidget />
    </div>
    <div class="m-greeting__date">{{ dateStr }}</div>
    <div class="m-greeting__quote">{{ quote }}</div>
  </div>
</template>

<style scoped>
.m-greeting {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.m-greeting__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.m-greeting__main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.m-greeting__date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
}

.m-greeting__quote {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  font-style: italic;
  line-height: 1.5;
}

.m-greeting__badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
}

.m-greeting__badge--holiday {
  background: rgba(255, 255, 255, 0.25);
}

.m-greeting__badge--weekend {
  background: rgba(255, 255, 255, 0.18);
}

.m-greeting__badge--offline {
  background: rgba(255, 200, 50, 0.3);
}
</style>
