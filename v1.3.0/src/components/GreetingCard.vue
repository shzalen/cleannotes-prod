<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isOnline } from '@/services/storage'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// 响应式时间源，每分钟更新（P3-02: 秒级精度无必要，改为 60s 降低 CPU 开销）
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 60000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const username = computed(() => {
  return auth.user?.nickname || auth.user?.email?.split('@')[0] || '用户'
})

// 根据时段生成问候语
const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

// 判断今天是否是节假日/周末
function getDayInfo(d: Date) {
  const day = d.getDay()
  const month = d.getMonth() + 1
  const date = d.getDate()

  // 周末
  const isWeekend = day === 0 || day === 6

  // 中国主要固定节假日（月, 日）
  const holidays: [number, number, string][] = [
    [1, 1, '元旦'],
    [2, 14, '情人节'],
    [3, 8, '妇女节'],
    [4, 5, '清明节'],
    [5, 1, '劳动节'],
    [5, 4, '青年节'],
    [6, 1, '儿童节'],
    [9, 10, '教师节'],
    [10, 1, '国庆节'],
    [10, 31, '万圣节'],
    [12, 25, '圣诞节'],
  ]

  const holiday = holidays.find(([m, dd]) => m === month && dd === date)
  return { isWeekend, holiday: holiday?.[2] || null, month, date }
}

const dayInfo = computed(() => getDayInfo(now.value))

// 计算 ISO 周数
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
  const pad = (n: number) => n.toString().padStart(2, '0')
  const weekNum = getISOWeekNumber(d)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]} · 第${weekNum}周 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

// 根据时间、节假日、周末随机显示激励语言
const quote = computed(() => {
  if (!isOnline.value) return '离线模式中，数据保存于本地'

  const h = now.value.getHours()
  const { isWeekend, holiday } = dayInfo.value

  // 节假日特别语录
  if (holiday) {
    const holidayQuotes = [
      `🎉 ${holiday}快乐！享受美好时光吧。`,
      `${holiday}快乐！今天给自己放个假。`,
      `今天是${holiday}，别忘了犒劳自己。`,
    ]
    return holidayQuotes[Math.floor(Math.random() * holidayQuotes.length)]
  }

  // 周末语录
  if (isWeekend) {
    const weekendQuotes = [
      '周末愉快！好好休息，下周更有力。',
      '休息是为了走更远的路。',
      '周末也值得被认真对待。',
      '充电时间到，享受当下。',
    ]
    return weekendQuotes[h % weekendQuotes.length]
  }

  // 工作日按时段
  if (h < 6) {
    const nightQuotes = ['夜深了，早点休息吧。', '熬夜伤身，注意身体。', '月色正好，但睡眠更重要。']
    return nightQuotes[now.value.getMinutes() % nightQuotes.length]
  }
  if (h < 9) {
    const morningQuotes = [
      '早起的鸟儿有虫吃，新的一天开始了。',
      '清晨的时光最宝贵，抓住每一分钟。',
      '新的早晨，新的可能，全力以赴。',
    ]
    return morningQuotes[now.value.getMinutes() % morningQuotes.length]
  }
  if (h < 12) {
    const amQuotes = [
      '专注当下，高效产出。',
      '保持节奏，稳步推进。',
      '每一步都算数，坚持就是胜利。',
    ]
    return amQuotes[now.value.getMinutes() % amQuotes.length]
  }
  if (h < 14) {
    const noonQuotes = [
      '午间充电，下午更有劲。',
      '适当休息，才能持续高效。',
    ]
    return noonQuotes[now.value.getMinutes() % noonQuotes.length]
  }
  if (h < 18) {
    const pmQuotes = [
      '坚持输出，量变引发质变。',
      '不积跬步，无以至千里。',
      '今日事，今日毕。',
      '离下班又近了一步，加油！',
    ]
    return pmQuotes[now.value.getMinutes() % pmQuotes.length]
  }

  const eveningQuotes = [
    '今天的努力，明天会感谢自己。',
    '复盘今天，规划明天。',
    '充实的一天，值得好好休息。',
  ]
  return eveningQuotes[now.value.getMinutes() % eveningQuotes.length]
})

</script>

<template>
  <div class="greeting">
    <div class="greeting-main">
      <span class="greeting-text">{{ greeting }}，{{ username }}</span>
      <span v-if="dayInfo.holiday" class="holiday-badge">{{ dayInfo.holiday }}</span>
      <span v-else-if="dayInfo.isWeekend" class="weekend-badge">周末</span>
      <span v-if="!isOnline" class="offline-badge">离线</span>
    </div>
    <div class="greeting-date">{{ dateStr }}</div>
    <blockquote class="greeting-quote">{{ quote }}</blockquote>
  </div>
</template>

<style scoped>
.greeting {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.greeting-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.greeting-text {
  font-size: 24px;
  font-weight: 500;
  color: var(--color-text-1);
  letter-spacing: -0.3px;
}

.greeting-date {
  font-size: 12px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}

.greeting-quote {
  position: relative;
  width: fit-content;
  margin-top: 14px;
  padding: 0 0 0 4px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text-2);
  font-style: italic;
}

.greeting-quote::before,
.greeting-quote::after {
  position: absolute;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 48px;
  line-height: 1;
  color: var(--color-text-3);
  opacity: 0.18;
  pointer-events: none;
  font-style: normal;
}

.greeting-quote::before {
  content: '\201C';
  top: -16px;
  left: -18px;
}

.greeting-quote::after {
  content: '\201D';
  bottom: -12px;
  right: -18px;
}

.offline-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-warning-text);
  background: var(--color-warning-light);
  border-radius: 999px;
}

.holiday-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-danger-text);
  background: var(--color-danger-light);
  border-radius: 999px;
}

.weekend-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-accent);
  background: var(--color-accent-light);
  border-radius: 999px;
}
</style>
