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
import { Lunar, Solar } from 'lunar-javascript'

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

// ── 二十四节气数据（通过 lunar-javascript getJieQi 动态检测，无需硬编码日期） ──
// 每个节气含季节色、含义、问候语；日期每年由 getJieQi() 自动计算
const JIE_QI_DATA: Record<string, { image: string; origin: string; description: string; greeting: string; accentColor: string }> = {
  '小寒': {
    image: 'holidays/xiaohan.svg',
    origin: '小寒是二十四节气中的第 23 个，冬季第五个节气，标志着一年中最寒冷的日子到来。',
    description: '小寒时节气温骤降，北方天寒地冻，南方也进入隆冬。习俗有吃腊八粥、探梅、冰戏等。',
    greeting: '小寒已至，注意保暖防寒。愿你冬日安康，温暖如春！',
    accentColor: '#5b9bd5',
  },
  '大寒': {
    image: 'holidays/dahan.svg',
    origin: '大寒是二十四节气中最后一个节气，也是一年中最寒冷的时期。',
    description: '大寒时节寒潮频繁，但已临近春节，人们开始忙年：扫尘、贴春联、备年货，辞旧迎新。',
    greeting: '大寒到，年关近。愿你腊月顺利，阖家团圆迎新春！',
    accentColor: '#4a7ab8',
  },
  '立春': {
    image: 'holidays/lichun.svg',
    origin: '立春是二十四节气之首，标志着春季开始，万物复苏。',
    description: '立春有「咬春」习俗，吃春饼、春卷。民间也祭春、鞭春牛，祈求一年风调雨顺。',
    greeting: '立春至，万象更新。愿你在新的一年生机盎然，前程似锦！',
    accentColor: '#4caf50',
  },
  '雨水': {
    image: 'holidays/yushui.svg',
    origin: '雨水是春季第二个节气，标志着降雨开始、雨量渐增。',
    description: '雨水时节气温回升，冰雪融化，草木萌动。有回娘屋、拉保保等民俗。',
    greeting: '雨水时节，润物无声。愿你的生活如春雨般滋养，充满希望！',
    accentColor: '#66bb6a',
  },
  '惊蛰': {
    image: 'holidays/jingzhe.svg',
    origin: '惊蛰意为春雷惊醒蛰伏的昆虫，标志着仲春开始。',
    description: '惊蛰时节春雷初响，万物生机盎然。习俗有祭白虎、吃梨、打小人等。',
    greeting: '惊蛰春雷响，万物皆生长。愿你的事业如春雷般轰鸣，一鸣惊人！',
    accentColor: '#7cb342',
  },
  '春分': {
    image: 'holidays/chunfen.svg',
    origin: '春分时昼夜平分，是春季中点，也是农事重要节点。',
    description: '春分有竖蛋、放风筝、吃春菜等习俗。昼夜等长，阴阳平衡。',
    greeting: '春分昼夜平，愿你生活也平衡美满，春意盎然！',
    accentColor: '#8bc34a',
  },
  '清明': {
    image: 'holidays/qingming.svg',
    origin: '清明既是节气也是节日，气温回升，天气清澈明朗。',
    description: '清明时节扫墓祭祖、踏青郊游、插柳放风筝，缅怀先人，感恩生活。',
    greeting: '清明时节，慎终追远。愿逝者安息，生者珍惜眼前人。',
    accentColor: '#4a7c59',
  },
  '谷雨': {
    image: 'holidays/guyu.svg',
    origin: '谷雨是春季最后一个节气，意为「雨生百谷」，降雨有利谷物生长。',
    description: '谷雨时节采茶、食香椿，渔民祭海。也是牡丹盛开之时。',
    greeting: '谷雨润万物，愿你的努力都如春苗般茁壮成长！',
    accentColor: '#9ccc65',
  },
  '立夏': {
    image: 'holidays/lixia.svg',
    origin: '立夏标志着夏季开始，气温显著升高，万物繁茂。',
    description: '立夏有称人、吃蛋、尝三鲜等习俗，祈求健康度夏。',
    greeting: '立夏已至，愿你清凉一夏，活力满满！',
    accentColor: '#ef5350',
  },
  '小满': {
    image: 'holidays/xiaoman.svg',
    origin: '小满意为夏熟作物籽粒开始灌浆饱满，但未成熟。',
    description: '小满时节有祭车神、祈蚕节等民俗，也是吃苦菜的季节。',
    greeting: '小满小满，人生刚好。愿你知足常乐，幸福圆满！',
    accentColor: '#ff7043',
  },
  '芒种': {
    image: 'holidays/mangzhong.svg',
    origin: '芒种意为有芒的麦子快收、有芒的稻子可种，是农事最忙的节气。',
    description: '芒种时节送花神、煮梅、安苗，农人抢收抢种，辛劳而充实。',
    greeting: '芒种忙忙，播种希望。愿你的耕耘都有好收成！',
    accentColor: '#ff5722',
  },
  '夏至': {
    image: 'holidays/xiazhi.svg',
    origin: '夏至是一年中白昼最长、黑夜最短的一天，标志着盛夏到来。',
    description: '夏至有吃面、祭神祀祖等习俗。此后阳气渐消，阴气始生。',
    greeting: '夏至白昼最长，愿你的快乐也绵长不断！',
    accentColor: '#e53935',
  },
  '小暑': {
    image: 'holidays/xiaoshu.svg',
    origin: '小暑意为「小热」，天气开始炎热，但未到极点。',
    description: '小暑时节晒书晒衣、食新米、吃饺子，民间有「头伏饺子二伏面」之说。',
    greeting: '小暑天气热，注意防暑降温。愿你清凉度夏！',
    accentColor: '#f44336',
  },
  '大暑': {
    image: 'holidays/dashu.svg',
    origin: '大暑是一年中最热的节气，正值三伏天中的中伏。',
    description: '大暑时节饮伏茶、晒伏姜、烧伏香。也有吃仙草、凤梨的习俗。',
    greeting: '大暑至，酷暑当头。注意防暑，愿你好运如骄阳般红火！',
    accentColor: '#d32f2f',
  },
  '立秋': {
    image: 'holidays/liqiu.svg',
    origin: '立秋标志着秋季开始，暑去凉来，万物收敛。',
    description: '立秋有「贴秋膘」、咬秋（吃西瓜）、晒秋等习俗，庆贺丰收在望。',
    greeting: '立秋至，暑气渐消。愿你秋日丰收，硕果累累！',
    accentColor: '#ff9800',
  },
  '处暑': {
    image: 'holidays/chushu.svg',
    origin: '处暑意为「出暑」，炎热离开，秋凉渐起。',
    description: '处暑时节放河灯、开渔节、吃鸭子，迎接金秋。',
    greeting: '处暑暑止，凉风渐起。愿你的生活清爽宜人！',
    accentColor: '#fb8c00',
  },
  '白露': {
    image: 'holidays/bailu.svg',
    origin: '白露时节夜间温度低，水汽凝结成白色露珠，标志着仲秋开始。',
    description: '白露有收清露、酿米酒、吃龙眼等习俗，天气转凉。',
    greeting: '白露秋分夜，一夜凉一夜。注意添衣，愿你秋安！',
    accentColor: '#ffa726',
  },
  '秋分': {
    image: 'holidays/qiufen.svg',
    origin: '秋分昼夜平分，是秋季中点，也是中国农民丰收节。',
    description: '秋分有祭月、竖蛋、吃秋菜等习俗。自 2018 年起定为「中国农民丰收节」。',
    greeting: '秋分至，丰收时。愿你的努力都化作金黄的果实！',
    accentColor: '#ffb300',
  },
  '寒露': {
    image: 'holidays/hanlu.svg',
    origin: '寒露气温比白露更低，露水寒冷，即将凝结成霜。',
    description: '寒露时节赏菊、登高、插茱萸，饮菊花酒。秋意渐浓。',
    greeting: '寒露至，秋意浓。注意保暖，愿你深秋安康！',
    accentColor: '#fb8c00',
  },
  '霜降': {
    image: 'holidays/shuangjiang.svg',
    origin: '霜降是秋季最后一个节气，初霜出现，万物萧索。',
    description: '霜降时节吃柿子、赏红叶，有「霜降摘柿子」的习俗。',
    greeting: '霜降秋尽，冬日将至。愿你温暖过秋，从容迎冬！',
    accentColor: '#f57c00',
  },
  '立冬': {
    image: 'holidays/lidong.svg',
    origin: '立冬标志着冬季开始，万物收藏，规避寒冷。',
    description: '立冬有吃饺子、补冬等习俗，北方「立冬不端饺子碗，冻掉耳朵没人管」。',
    greeting: '立冬至，万物藏。注意御寒保暖，愿你冬日安康！',
    accentColor: '#1976d2',
  },
  '小雪': {
    image: 'holidays/xiaoxue.svg',
    origin: '小雪时节气温下降，开始降雪但雪量不大。',
    description: '小雪有腌腊肉、吃糍粑、晒鱼干等习俗，准备过冬。',
    greeting: '小雪初降，注意保暖。愿你的冬日温馨如雪！',
    accentColor: '#42a5f5',
  },
  '大雪': {
    image: 'holidays/daxue.svg',
    origin: '大雪时节雪量增大，地面可能积雪，标志着仲冬开始。',
    description: '大雪有腌肉、进补、观赏封河等习俗，「小雪腌菜，大雪腌肉」。',
    greeting: '大雪纷飞，瑞雪兆丰年。愿你冬日温暖，来年顺遂！',
    accentColor: '#1e88e5',
  },
  '冬至': {
    image: 'holidays/dongzhi.svg',
    origin: '冬至是北半球白昼最短的一天，古人视为「亚岁」，极为重要。',
    description: '冬至北方吃饺子，南方吃汤圆。有「冬至大如年」之说，也是祭祖之日。',
    greeting: '冬至阳生春又来。愿你阖家团圆，温暖过冬！',
    accentColor: '#1565c0',
  },
}

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

  // 检查二十四节气（通过 lunar-javascript 动态计算，每年日期准确）
  try {
    const solar = Solar.fromYmd(year, month, day)
    const lunar = solar.getLunar()
    const jieQi = lunar.getJieQi()
    if (jieQi && JIE_QI_DATA[jieQi]) {
      const data = JIE_QI_DATA[jieQi]
      return {
        key: `jieqi-${jieQi}`,
        name: jieQi,
        solarDate: dateStr,
        image: data.image,
        origin: data.origin,
        description: data.description,
        greeting: data.greeting,
        accentColor: data.accentColor,
      }
    }
  } catch {
    // lunar-javascript 计算失败时忽略
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
