import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TimerConfig } from '@/types'
import { getStorage } from '@/services/storage'

export const useTimerStore = defineStore('timer', () => {
  const config = ref<TimerConfig>({
    workStart: '09:00',
    workEnd: '18:00',
    workDays: [1, 2, 3, 4, 5],
  })
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    const storage = getStorage()
    const saved = await storage.getTimerConfig()
    if (saved) config.value = saved
    loaded.value = true
  }

  async function save() {
    const storage = getStorage()
    await storage.saveTimerConfig(config.value)
  }

  const countdownLabel = computed(() => {
    const now = new Date()
    const day = now.getDay() || 7
    if (!config.value.workDays.includes(day)) return '休息日'

    const [sh, sm] = config.value.workStart.split(':').map(Number)
    const [eh, em] = config.value.workEnd.split(':').map(Number)
    const start = new Date(now); start.setHours(sh, sm, 0, 0)
    const end = new Date(now); end.setHours(eh, em, 0, 0)

    if (now < start) return '距上班'
    if (now >= end) return '已下班'
    return '距下班'
  })

  const countdownMs = computed(() => {
    const now = new Date()
    const day = now.getDay() || 7
    if (!config.value.workDays.includes(day)) return 0

    const [sh, sm] = config.value.workStart.split(':').map(Number)
    const [eh, em] = config.value.workEnd.split(':').map(Number)
    const start = new Date(now); start.setHours(sh, sm, 0, 0)
    const end = new Date(now); end.setHours(eh, em, 0, 0)

    if (now < start) return start.getTime() - now.getTime()
    if (now >= end) return 0
    return end.getTime() - now.getTime()
  })

  function formatMs(ms: number): string {
    if (ms <= 0) return '00:00:00'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return { config, load, save, countdownLabel, countdownMs, formatMs }
})
