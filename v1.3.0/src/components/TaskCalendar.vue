<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '@/types'
import { Lunar, Solar } from 'lunar-javascript'
import { toLocalDate } from '@/utils/time'

const props = defineProps<{
  tasks: Task[]
  modelValue: string // selected date YYYY-MM-DD
}>()
const emit = defineEmits<{
  'update:modelValue': [date: string]
}>()

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth()) // 0-based

const today = toLocalDate()

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function getMonthDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

// ---- 农历 ----
interface LunarInfo {
  dayStr: string    // 如 "初一"、"十五"
  monthStr: string  // 如 "正月"
  isFestival: boolean // 是否为农历节日
  festivalName: string // 农历节日名称
}

function getLunarInfo(year: number, month: number, day: number): LunarInfo {
  try {
    const solar = Solar.fromYmd(year, month + 1, day)
    const lunar = solar.getLunar()
    const dayStr = lunar.getDayInChinese()
    const monthStr = lunar.getMonthInChinese()

    // 农历节日
    const festivals = lunar.getFestivals()
    let festivalName = ''
    if (festivals.length > 0) {
      festivalName = festivals[0]
    }

    // 初一显示月名
    const isMonthStart = dayStr === '初一'

    return {
      dayStr: isMonthStart ? monthStr + '月' : dayStr,
      monthStr,
      isFestival: festivalName !== '',
      festivalName,
    }
  } catch {
    return { dayStr: '', monthStr: '', isFestival: false, festivalName: '' }
  }
}

// ---- 法定节假日 / 节气 / 放假调休 ----
interface HolidayInfo {
  name: string
  type: 'holiday' | 'solar_term' | 'lunar_festival'
}

// 放假/调休数据：key=YYYY-MM-DD, value=rest(休)/work(班)
// 包含 2025-2026 年国务院公布的放假安排
const VACATION_MAP: Record<string, '休' | '班'> = {
  // ---- 2025 年 ----
  // 元旦
  '2025-01-01': '休',
  // 春节
  '2025-01-28': '休', '2025-01-29': '休', '2025-01-30': '休', '2025-01-31': '休',
  '2025-02-01': '休', '2025-02-02': '休', '2025-02-03': '休', '2025-02-04': '休',
  '2025-01-26': '班', '2025-02-08': '班',
  // 清明
  '2025-04-04': '休', '2025-04-05': '休', '2025-04-06': '休',
  // 劳动节
  '2025-05-01': '休', '2025-05-02': '休', '2025-05-03': '休', '2025-05-04': '休', '2025-05-05': '休',
  '2025-04-27': '班',
  // 端午
  '2025-05-31': '休', '2025-06-01': '休', '2025-06-02': '休',
  // 中秋+国庆
  '2025-10-01': '休', '2025-10-02': '休', '2025-10-03': '休', '2025-10-04': '休',
  '2025-10-05': '休', '2025-10-06': '休', '2025-10-07': '休', '2025-10-08': '休',
  '2025-09-28': '班', '2025-10-11': '班',

  // ---- 2026 年 ----
  // 元旦
  '2026-01-01': '休', '2026-01-02': '休', '2026-01-03': '休',
  '2025-12-27': '班',
  // 春节 (2026-02-17 = 农历正月初一)
  '2026-02-16': '休', '2026-02-17': '休', '2026-02-18': '休', '2026-02-19': '休',
  '2026-02-20': '休', '2026-02-21': '休', '2026-02-22': '休',
  '2026-02-14': '班', '2026-02-28': '班',
  // 清明
  '2026-04-04': '休', '2026-04-05': '休', '2026-04-06': '休',
  // 劳动节
  '2026-05-01': '休', '2026-05-02': '休', '2026-05-03': '休', '2026-05-04': '休', '2026-05-05': '休',
  '2026-04-26': '班',
  // 端午 (2026-06-19 = 农历五月初五)
  '2026-06-19': '休', '2026-06-20': '休', '2026-06-21': '休',
  // 中秋 (2026-09-25 = 农历八月十五)
  '2026-10-01': '休', '2026-10-02': '休', '2026-10-03': '休', '2026-10-04': '休',
  '2026-10-05': '休', '2026-10-06': '休', '2026-10-07': '休', '2026-10-08': '休',
  '2026-09-27': '班', '2026-10-10': '班',
}

function getVacationTag(dateKey: string): '休' | '班' | '' {
  return VACATION_MAP[dateKey] ?? ''
}

// 法定节假日（按日期 key: MM-DD）
const LEGAL_HOLIDAYS: Record<string, string> = {
  '01-01': '元旦',
  // 春节按农历计算，在下面动态生成
  '05-01': '劳动节',
  '10-01': '国庆节',
  // 清明按节气计算
}

// 获取某年的春节日期（公历）
function getSpringFestivalDate(year: number): string {
  try {
    // 春节 = 农历正月初一
    const lunar = Lunar.fromYmd(year, 1, 1)
    const solar = lunar.getSolar()
    const m = String(solar.getMonth()).padStart(2, '0')
    const d = String(solar.getDay()).padStart(2, '0')
    return `${year}-${m}-${d}`
  } catch {
    return ''
  }
}

// 获取某年的清明节日期（公历，基于节气）
function getQingmingDate(year: number): string {
  try {
    const solar = Solar.fromYmd(year, 4, 5)
    const lunar = solar.getLunar()
    const jieQi = lunar.getJieQi()
    if (jieQi === '清明') {
      return `${year}-04-05`
    }
    // 尝试4月4日
    const solar2 = Solar.fromYmd(year, 4, 4)
    const lunar2 = solar2.getLunar()
    if (lunar2.getJieQi() === '清明') {
      return `${year}-04-04`
    }
    return `${year}-04-05` // 默认
  } catch {
    return `${year}-04-05`
  }
}

// 获取某年的端午节（农历五月初五）
function getDragonBoatDate(year: number): string {
  try {
    const lunar = Lunar.fromYmd(year, 5, 5)
    const solar = lunar.getSolar()
    const m = String(solar.getMonth()).padStart(2, '0')
    const d = String(solar.getDay()).padStart(2, '0')
    return `${year}-${m}-${d}`
  } catch {
    return ''
  }
}

// 获取某年的中秋节（农历八月十五）
function getMidAutumnDate(year: number): string {
  try {
    const lunar = Lunar.fromYmd(year, 8, 15)
    const solar = lunar.getSolar()
    const m = String(solar.getMonth()).padStart(2, '0')
    const d = String(solar.getDay()).padStart(2, '0')
    return `${year}-${m}-${d}`
  } catch {
    return ''
  }
}

// 生成某年的所有节假日
const yearHolidays = computed(() => {
  const y = viewYear.value
  const map: Record<string, HolidayInfo> = {}

  // 固定日期节假日
  for (const [key, name] of Object.entries(LEGAL_HOLIDAYS)) {
    map[`${y}-${key}`] = { name, type: 'holiday' }
  }

  // 春节
  const sf = getSpringFestivalDate(y)
  if (sf) map[sf] = { name: '春节', type: 'holiday' }
  // 春节前一天的除夕
  try {
    const sfDate = new Date(sf)
    sfDate.setDate(sfDate.getDate() - 1)
    const chuxi = toLocalDate(sfDate)
    map[chuxi] = { name: '除夕', type: 'lunar_festival' }
  } catch {}

  // 清明
  const qm = getQingmingDate(y)
  if (qm) map[qm] = { name: '清明', type: 'holiday' }

  // 端午
  const db = getDragonBoatDate(y)
  if (db) map[db] = { name: '端午', type: 'holiday' }

  // 中秋
  const ma = getMidAutumnDate(y)
  if (ma) map[ma] = { name: '中秋', type: 'holiday' }

  return map
})

function getHolidayName(dateKey: string): string {
  return yearHolidays.value[dateKey]?.name ?? ''
}

function isHoliday(dateKey: string): boolean {
  return !!yearHolidays.value[dateKey]
}

// 获取节气
function getSolarTerm(year: number, month: number, day: number): string {
  try {
    const solar = Solar.fromYmd(year, month + 1, day)
    const lunar = solar.getLunar()
    const jieQi = lunar.getJieQi()
    return jieQi || ''
  } catch {
    return ''
  }
}

// 日期下方显示文字（优先级：法定节假日 > 节气 > 农历节日 > 农历日期）
function getDateSubText(year: number, month: number, day: number, dateKey: string): { text: string; isHoliday: boolean; isSpecial: boolean } {
  // 1. 法定节假日
  const holiday = getHolidayName(dateKey)
  if (holiday) return { text: holiday, isHoliday: true, isSpecial: true }

  // 2. 节气
  const solarTerm = getSolarTerm(year, month, day)
  if (solarTerm) return { text: solarTerm, isHoliday: false, isSpecial: true }

  // 3. 农历节日
  const lunarInfo = getLunarInfo(year, month, day)
  if (lunarInfo.isFestival) return { text: lunarInfo.festivalName, isHoliday: false, isSpecial: true }

  // 4. 农历日期
  return { text: lunarInfo.dayStr, isHoliday: false, isSpecial: false }
}

// 生成日历网格
const calendarGrid = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 周一为一周第一天: 0=周日, 1=周一...需要转换
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const days: {
    day: number
    dateKey: string
    isCurrentMonth: boolean
    subText: { text: string; isHoliday: boolean; isSpecial: boolean }
    vacationTag: '休' | '班' | ''
    isVacationRest: boolean
    isWeekendDay: boolean
  }[] = []

  // 上月末尾日期
  const prevLast = new Date(year, month, 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevLast - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    const dk = getMonthDateKey(y, m, d)
    const vTag = getVacationTag(dk)
    days.push({
      day: d, dateKey: dk, isCurrentMonth: false,
      subText: getDateSubText(y, m, d, dk),
      vacationTag: vTag,
      isVacationRest: vTag === '休',
      isWeekendDay: isWeekend(dk),
    })
  }

  // 当月
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dk = getMonthDateKey(year, month, d)
    const vTag = getVacationTag(dk)
    days.push({
      day: d, dateKey: dk, isCurrentMonth: true,
      subText: getDateSubText(year, month, d, dk),
      vacationTag: vTag,
      isVacationRest: vTag === '休',
      isWeekendDay: isWeekend(dk),
    })
  }

  // 下月开头：只补充到填满当前最后一行，不额外增加一整行非当月日期
  const remainder = days.length % 7
  const remaining = remainder === 0 ? 0 : 7 - remainder
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    const dk = getMonthDateKey(y, m, d)
    const vTag = getVacationTag(dk)
    days.push({
      day: d, dateKey: dk, isCurrentMonth: false,
      subText: getDateSubText(y, m, d, dk),
      vacationTag: vTag,
      isVacationRest: vTag === '休',
      isWeekendDay: isWeekend(dk),
    })
  }

  return days
})

// 每个日期的任务统计（以 startDate 为主，无则回退 createdAt，与任务列表过滤口径一致）
function getDateStats(dateKey: string) {
  const dayTasks = props.tasks.filter(t =>
    (t.startDate || t.createdAt.slice(0, 10)) === dateKey
  )
  const done = dayTasks.filter(t => t.status === 'done').length
  const pending = dayTasks.filter(t => t.status !== 'done').length
  return { total: dayTasks.length, done, pending }
}

function selectDate(dateKey: string) {
  emit('update:modelValue', dateKey)
}

function goToday() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  emit('update:modelValue', today)
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

const weekHeaders = ['一', '二', '三', '四', '五', '六', '日']

// 是否周末
function isWeekend(dateKey: string): boolean {
  const day = new Date(dateKey).getDay()
  return day === 0 || day === 6
}
</script>

<template>
  <div class="calendar-card">
    <!-- Month header -->
    <div class="cal-header">
      <button class="cal-nav" @click="prevMonth">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span class="cal-month">{{ viewYear }}年{{ viewMonth + 1 }}月</span>
      <button class="cal-nav" @click="nextMonth">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <!-- Week headers -->
    <div class="cal-weekdays">
      <span v-for="h in weekHeaders" :key="h" :class="['cal-wd', { 'cal-wd-weekend': h === '六' || h === '日' }]">{{ h }}</span>
    </div>

    <!-- Days grid -->
    <div class="cal-days">
      <button
        v-for="cell in calendarGrid"
        :key="cell.dateKey"
        :class="[
          'cal-day',
          { 'other-month': !cell.isCurrentMonth },
          { 'is-today': cell.dateKey === today },
          { 'is-selected': cell.dateKey === modelValue },
          { 'is-holiday': cell.subText.isHoliday },
          { 'is-weekend': cell.isCurrentMonth && cell.isWeekendDay },
          { 'is-vacation-rest': cell.isVacationRest },
          { 'is-workday': cell.vacationTag === '班' },
        ]"
        @click="selectDate(cell.dateKey)"
      >
        <span class="day-num">{{ cell.day }}</span>
        <span :class="['day-lunar', { 'lunar-special': cell.subText.isSpecial, 'lunar-holiday': cell.subText.isHoliday }]">
          {{ cell.subText.text }}
        </span>
        <span v-if="cell.vacationTag" :class="['vacation-tag', cell.vacationTag === '休' ? 'tag-rest' : 'tag-work']">
          {{ cell.vacationTag }}
        </span>
        <div v-if="getDateStats(cell.dateKey).total > 0" class="day-dots">
          <span v-if="getDateStats(cell.dateKey).pending > 0" class="dot pending" />
          <span v-if="getDateStats(cell.dateKey).done > 0" class="dot done" />
        </div>
      </button>
    </div>

    <button class="btn-today" @click="goToday">回到今天</button>
  </div>
</template>

<style scoped>
.calendar-card {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 1px 3px var(--color-shadow);
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cal-month {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.cal-nav {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-bg-3);
  border-radius: 6px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.cal-nav:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  margin-bottom: 1px;
}

.cal-wd {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-3);
  padding: 3px 0;
}

.cal-wd-weekend {
  color: var(--color-danger);
}

.cal-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.cal-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 46px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.12s;
  padding: 3px 2px;
  position: relative;
}

.cal-day:hover {
  background: var(--color-bg-4);
}

.cal-day.other-month .day-num,
.cal-day.other-month .day-lunar {
  color: var(--color-text-4);
}

.cal-day .day-num {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-2);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}

.cal-day.is-today .day-num {
  background: var(--color-success);
  color: var(--color-white);
  font-weight: 600;
}

.cal-day.is-selected:not(.is-today) .day-num {
  background: var(--color-success-light);
  color: var(--color-success-text);
  font-weight: 600;
  border: 1.5px solid var(--color-success);
}

/* 农历文字 */
.day-lunar {
  font-size: 9px;
  color: var(--color-text-3);
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-lunar.lunar-special {
  color: var(--color-text-2);
}

.day-lunar.lunar-holiday {
  color: var(--color-danger);
  font-weight: 500;
}

/* 周末日期数字 */
.cal-day.is-weekend .day-num {
  color: var(--color-danger);
}

/* 周末/放假背景色 */
.cal-day.is-weekend:not(.other-month),
.cal-day.is-vacation-rest:not(.other-month) {
  background: var(--color-danger-light);
}

.cal-day.is-weekend:not(.other-month):hover,
.cal-day.is-vacation-rest:not(.other-month):hover {
  background: var(--color-danger-light);
}

/* 补班日标记 */
.cal-day.is-workday:not(.other-month) {
  background: var(--color-warning-light);
}

.cal-day.is-workday:not(.other-month):hover {
  background: var(--color-warning-light);
}

/* 放假标签 */
.vacation-tag {
  font-size: 8px;
  font-weight: 600;
  line-height: 1;
  border-radius: 2px;
  padding: 0 2px;
  position: absolute;
  top: 2px;
  right: 2px;
}

.tag-rest {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.tag-work {
  color: var(--color-warning-text);
  background: var(--color-warning-light);
}

.cal-day.is-today.is-weekend .day-num {
  color: var(--color-white);
}

.cal-day.is-selected.is-weekend:not(.is-today) .day-num {
  color: var(--color-success-text);
}

.day-dots {
  display: flex;
  gap: 2px;
  align-items: center;
  justify-content: center;
  height: 3px;
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
}

.dot.pending { background: var(--color-warning); }
.dot.done { background: var(--color-success); }

.btn-today {
  margin-top: 8px;
  width: 100%;
  padding: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-3);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-today:hover {
  background: var(--color-bg-4);
  color: var(--color-text-1);
}
</style>
