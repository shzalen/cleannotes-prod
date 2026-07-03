declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
    getMonth(): number
    getDay(): number
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    getSolar(): Solar
    getDayInChinese(): string
    getMonthInChinese(): string
    getFestivals(): string[]
    getJieQi(): string
  }
}
