import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto' | 'zuru' | 'tencent'

const STORAGE_KEY = 'cleannotes_theme'

const mode = ref<ThemeMode>('tencent')
const isDark = ref(false)
const isZuru = computed(() => mode.value === 'zuru')
const isTencent = computed(() => mode.value === 'tencent')

let mediaQuery: MediaQueryList | null = null

function getDataTheme(): string {
  if (mode.value === 'zuru') return 'zuru'
  if (mode.value === 'tencent') return 'tencent'
  if (mode.value === 'dark') return 'dark'
  if (mode.value === 'auto') {
    return mediaQuery?.matches ? 'dark' : 'light'
  }
  return 'tencent'
}

function applyTheme() {
  const theme = getDataTheme()
  isDark.value = theme === 'dark'
  document.documentElement.setAttribute('data-theme', theme)
}

function onMediaChange() {
  if (mode.value === 'auto') {
    applyTheme()
  }
}

export function useTheme() {
  onMounted(() => {
    // Read persisted preference
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (stored && ['light', 'dark', 'auto', 'zuru', 'tencent'].includes(stored)) {
      // 浅色已隐藏，遗留 preference 自动迁移为腾讯蓝
      mode.value = stored === 'light' ? 'tencent' : stored
    }

    // Set up media query listener
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', onMediaChange)

    // Apply initial theme
    applyTheme()
  })

  // R3-P05: Clean up mediaQuery listener on unmount
  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', onMediaChange)
      mediaQuery = null
    }
  })

  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
    applyTheme()
  })

  function setTheme(newMode: ThemeMode) {
    mode.value = newMode
  }

  function toggle() {
    if (mode.value === 'tencent') {
      mode.value = 'dark'
    } else if (mode.value === 'dark') {
      mode.value = 'auto'
    } else {
      mode.value = 'tencent'
    }
  }

  return {
    mode,
    isDark,
    isZuru,
    isTencent,
    setTheme,
    toggle,
  }
}
