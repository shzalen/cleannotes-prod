/**
 * 节日问候卡片 — 当天首次打开 app 时弹出
 *
 * 数据模型：
 * - 公历节日：固定 MM-DD
 * - 农历节日：通过 lunar-javascript 计算公历日期
 * - 每个节日含：名称、图片 URL、起源、说明、问候语
 *
 * 弹出控制：localStorage 记录 `holiday_card_shown_{YYYY-MM-DD}`，当天只弹一次
 */
import { ref } from 'vue'
import { Lunar } from 'lunar-javascript'

export interface HolidayInfo {
  /** 节日唯一 key，用于图片选择和日志 */
  key: string
  /** 显示名称，如「春节」「国庆节」 */
  name: string
  /** 公历日期 YYYY-MM-DD（农历节日已转换为公历） */
  solarDate: string
  /** 节日相关图片 URL（网络图片） */
  image: string
  /** 节日起源（简短） */
  origin: string
  /** 节日说明 / 习俗 */
  description: string
  /** 问候语 */
  greeting: string
  /** 主题色（用于卡片装饰，可选） */
  accentColor?: string
}

// ── 公历节日数据（固定 MM-DD） ──
// 每个节日含图片、起源、说明、问候语
const SOLAR_HOLIDAYS: Array<{
  key: string
  name: string
  monthDay: string // MM-DD
  image: string
  origin: string
  description: string
  greeting: string
  accentColor?: string
}> = [
  {
    key: 'new-year',
    name: '元旦',
    monthDay: '01-01',
    image: 'holidays/new-year.svg',
    origin: '「元」意为开始，「旦」意为早晨。元旦即新年的第一天，公历1月1日。',
    description: '元旦标志着新的一年开始，人们常以许愿、团聚、倒数等方式迎接新年到来。',
    greeting: '新年新气象，愿你在新的一年里万事顺意，心想事成！',
    accentColor: '#e63946',
  },
  {
    key: 'valentines',
    name: '情人节',
    monthDay: '02-14',
    image: 'holidays/valentine.svg',
    origin: '源于西方，纪念圣瓦伦丁。2月14日成为表达爱意的节日。',
    description: '情人节是向心爱之人表达情感的日子，玫瑰、巧克力与贺卡是常见的礼物。',
    greeting: '愿有情人终成眷属，爱意常在心间！',
    accentColor: '#e63946',
  },
  {
    key: 'womens-day',
    name: '妇女节',
    monthDay: '03-08',
    image: 'holidays/womens-day.svg',
    origin: '为纪念1909年芝加哥女工罢工而设立，1975年由联合国正式确认。',
    description: '国际妇女节旨在庆祝女性在经济、政治和社会等领域的成就，倡导性别平等。',
    greeting: '致敬每一位闪闪发光的女性，愿你自信、独立、被世界温柔以待！',
    accentColor: '#e91e8c',
  },
  {
    key: 'qingming',
    name: '清明节',
    monthDay: '04-05',
    image: 'holidays/qingming.svg',
    origin: '清明节源自古代寒食节与上巳节，是二十四节气之一，公历4月4-6日之间。',
    description: '清明既是节气也是节日，人们在此日扫墓祭祖、踏青郊游，缅怀先人。',
    greeting: '清明时节，慎终追远。愿逝者安息，生者珍惜眼前人。',
    accentColor: '#4a7c59',
  },
  {
    key: 'labor-day',
    name: '劳动节',
    monthDay: '05-01',
    image: 'holidays/labor-day.svg',
    origin: '源于1886年芝加哥工人争取八小时工作制的运动，1889年第二国际确立5月1日为国际劳动节。',
    description: '劳动节是劳动者的节日，也是春暖花开时休憩放松、出行游玩的好时光。',
    greeting: '致敬每一份辛勤的付出！愿你的努力都有回报，生活如春日般明媚。',
    accentColor: '#e63946',
  },
  {
    key: 'youth-day',
    name: '青年节',
    monthDay: '05-04',
    image: 'holidays/youth-day.svg',
    origin: '为纪念1919年5月4日爆发的「五四运动」而设立，1939年由陕甘宁边区首次确定。',
    description: '五四青年节弘扬爱国、进步、民主、科学的精神，是青年人的节日。',
    greeting: '青春正当时，愿你以梦为马，不负韶华！',
    accentColor: '#1976d2',
  },
  {
    key: 'childrens-day',
    name: '儿童节',
    monthDay: '06-01',
    image: 'holidays/childrens-day.svg',
    origin: '为悼念1942年利迪策惨案中的儿童，1949年国际民主妇联确立6月1日为国际儿童节。',
    description: '儿童节是孩子们的欢乐节日，也提醒成人守护童心、关爱儿童成长。',
    greeting: '愿你永葆童心，眼里有光，心中有爱，快乐常伴！',
    accentColor: '#ff9800',
  },
  {
    key: 'teachers-day',
    name: '教师节',
    monthDay: '09-10',
    image: 'holidays/teachers-day.svg',
    origin: '1985年第六届全国人大常委会确定9月10日为教师节，旨在弘扬尊师重教的传统。',
    description: '教师节是向辛勤园丁致敬的日子，感念师恩，感谢师长的教诲与付出。',
    greeting: '感谢师恩，愿每一位引路人都被温柔以待，桃李满天下！',
    accentColor: '#e63946',
  },
  {
    key: 'national-day',
    name: '国庆节',
    monthDay: '10-01',
    image: 'holidays/national-day.svg',
    origin: '1949年10月1日中华人民共和国成立，每年此日为国庆节。',
    description: '国庆节是祖国的生日，常以阅兵、烟花、升旗等仪式庆祝，为期七天的假期称「黄金周」。',
    greeting: '盛世华诞，普天同庆！愿祖国繁荣昌盛，山河无恙，人间皆安！',
    accentColor: '#e63946',
  },
  {
    key: 'halloween',
    name: '万圣节',
    monthDay: '10-31',
    image: 'holidays/halloween.svg',
    origin: '源自古代凯尔特人的萨温节，后融入基督教传统，10月31日为万圣节前夜。',
    description: '万圣节前夜人们装扮成鬼怪形象，孩子们挨家挨户讨糖，主题是「不给糖就捣蛋」。',
    greeting: 'Trick or Treat！愿你的生活甜过糖果，惊喜多于惊吓！',
    accentColor: '#ff6f00',
  },
  {
    key: 'christmas',
    name: '圣诞节',
    monthDay: '12-25',
    image: 'holidays/christmas.svg',
    origin: '基督教节日，纪念耶稣基督诞生。12月25日为圣诞节，24日夜为平安夜。',
    description: '圣诞节以圣诞树、礼物、颂歌为主题，是家人团聚、传递祝福的温馨节日。',
    greeting: 'Merry Christmas！愿你的冬日温暖如春，所愿皆所得！',
    accentColor: '#e63946',
  },
]

// ── 农历节日数据 ──
// 通过 lunar-javascript 计算当年对应的公历日期
const LUNAR_HOLIDAYS: Array<{
  key: string
  name: string
  lunarMonth: number // 农历月（1-12，闰月为负）
  lunarDay: number   // 农历日
  image: string
  origin: string
  description: string
  greeting: string
  accentColor?: string
}> = [
  {
    key: 'spring-festival',
    name: '春节',
    lunarMonth: 1,
    lunarDay: 1,
    image: 'holidays/spring-festival.svg',
    origin: '春节即农历新年，是中华民族最隆重的传统佳节，源自上古时代岁首祈年祭祀。',
    description: '春节以团圆、守岁、拜年、贴春联、放鞭炮为核心习俗，象征辞旧迎新、阖家团圆。',
    greeting: '新春大吉！愿新的一年红红火火，阖家幸福，万事如意！',
    accentColor: '#e63946',
  },
  {
    key: 'lantern',
    name: '元宵节',
    lunarMonth: 1,
    lunarDay: 15,
    image: 'holidays/lantern-festival.svg',
    origin: '元宵节又称上元节，农历正月十五，是一年中第一个月圆之夜，汉代已有赏灯习俗。',
    description: '元宵节以赏花灯、猜灯谜、吃元宵（汤圆）为习俗，象征团圆美满。',
    greeting: '月圆人圆事事圆！元宵佳节，愿你阖家团圆，甜蜜美满！',
    accentColor: '#ff9800',
  },
  {
    key: 'dragon-boat',
    name: '端午节',
    lunarMonth: 5,
    lunarDay: 5,
    image: 'holidays/dragon-boat.svg',
    origin: '端午节源自纪念战国时期楚国诗人屈原，也有迎夏至、驱邪避瘟之意。',
    description: '端午节以赛龙舟、吃粽子、挂艾草、佩香囊为习俗，是国家级非物质文化遗产。',
    greeting: '端午安康！愿你如龙舟般乘风破浪，生活如粽香般甜蜜悠长！',
    accentColor: '#4a7c59',
  },
  {
    key: 'mid-autumn',
    name: '中秋节',
    lunarMonth: 8,
    lunarDay: 15,
    image: 'holidays/mid-autumn.svg',
    origin: '中秋节源自古代秋分祭月习俗，唐代成为正式节日，农历八月十五月最圆。',
    description: '中秋节以赏月、吃月饼、团圆为核心，象征家人团聚、思念远方亲人。',
    greeting: '海上生明月，天涯共此时。中秋快乐，愿你阖家团圆，幸福美满！',
    accentColor: '#1976d2',
  },
  {
    key: 'double-ninth',
    name: '重阳节',
    lunarMonth: 9,
    lunarDay: 9,
    image: 'holidays/double-ninth.svg',
    origin: '重阳节即农历九月初九，「九」为阳数之极，二九相重故称「重阳」。',
    description: '重阳节有登高、赏菊、佩茱萸、饮菊花酒的习俗，现代也是「敬老节」。',
    greeting: '重阳佳节，愿长辈安康长寿！登高望远，愿你前程似锦！',
    accentColor: '#ff9800',
  },
]

// ── 农历转公历工具 ──
function lunarToSolarDate(year: number, lunarMonth: number, lunarDay: number): string | null {
  try {
    // lunar-javascript: Lunar.fromYmd(year, month, day)
    // 闰月为负数，正常月份为正数
    const lunar = Lunar.fromYmd(year, lunarMonth, lunarDay)
    const solar = lunar.getSolar()
    const m = String(solar.getMonth()).padStart(2, '0')
    const d = String(solar.getDay()).padStart(2, '0')
    return `${year}-${m}-${d}`
  } catch {
    return null
  }
}

// ── 获取某天的节日信息 ──
export function getHolidayForDate(date: Date): HolidayInfo | null {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const mdStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // 检查公历节日
  for (const h of SOLAR_HOLIDAYS) {
    if (h.monthDay === mdStr) {
      return {
        key: h.key,
        name: h.name,
        solarDate: dateStr,
        image: h.image,
        origin: h.origin,
        description: h.description,
        greeting: h.greeting,
        accentColor: h.accentColor,
      }
    }
  }

  // 检查农历节日
  for (const h of LUNAR_HOLIDAYS) {
    const solarDate = lunarToSolarDate(year, h.lunarMonth, h.lunarDay)
    if (solarDate === dateStr) {
      return {
        key: h.key,
        name: h.name,
        solarDate: dateStr,
        image: h.image,
        origin: h.origin,
        description: h.description,
        greeting: h.greeting,
        accentColor: h.accentColor,
      }
    }
  }

  return null
}

// ── 弹出控制：当天首次打开 ──
const STORAGE_PREFIX = 'holiday_card_shown_'

function isAlreadyShownToday(date: Date): boolean {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  try {
    return localStorage.getItem(STORAGE_PREFIX + dateStr) === '1'
  } catch {
    return false
  }
}

function markShownToday(date: Date) {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  try {
    localStorage.setItem(STORAGE_PREFIX + dateStr, '1')
    // 清理 7 天前的记录，避免无限增长
    cleanupOldRecords()
  } catch {
    // ignore
  }
}

function cleanupOldRecords() {
  try {
    const keysToRemove: string[] = []
    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) {
        const dateStr = k.slice(STORAGE_PREFIX.length)
        const d = new Date(dateStr)
        if (!isNaN(d.getTime()) && now - d.getTime() > sevenDaysMs) {
          keysToRemove.push(k)
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

// ── 响应式状态 ──
const showCard = ref(false)
const currentHoliday = ref<HolidayInfo | null>(null)

/**
 * 检查并触发节日卡片（当天首次打开时）
 * 应在 app 挂载、用户已登录后调用
 */
export function checkAndShowHolidayCard() {
  const now = new Date()
  if (isAlreadyShownToday(now)) return

  const holiday = getHolidayForDate(now)
  if (holiday) {
    currentHoliday.value = holiday
    showCard.value = true
    markShownToday(now)
  }
}

export function useHolidayGreeting() {
  return {
    showCard,
    currentHoliday,
    checkAndShowHolidayCard,
    closeCard: () => { showCard.value = false },
  }
}
