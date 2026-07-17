import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const host = process.env.TAURI_DEV_HOST
const analyze = process.env.ANALYZE === 'true'

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function buildTime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __BUILD_TIME__: JSON.stringify(buildTime()),
  },
  plugins: [
    vue(),
    tailwindcss(),
    // Auto-copy README.md to public/ during build so it's served at /readme.txt
    {
      name: 'copy-readme',
      buildStart() {
        const src = resolve(__dirname, 'README.md')
        const dest = resolve(__dirname, 'public', 'readme.txt')
        copyFileSync(src, dest)
      },
    },
    analyze &&
      visualizer({
        open: false,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    rollupOptions: {
      treeshake: {
        // Vant 4 的 package.json sideEffects 仅保留 CSS、标记 JS 为无副作用，
        // 导致 app.use(Vant) 间接注册的组件被 Rollup tree-shake 掉。
        // 此处强制将 vant 的所有模块标记为有副作用，保留全部组件。
        moduleSideEffects: (id, external) => {
          if (external) return null
          if (id.includes('node_modules/vant')) return true
          return null
        },
      },
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile.html'),
      },
      output: {
        manualChunks(id) {
          // Split heavy editor dependencies by functional group for finer-grained loading
          if (id.includes('node_modules')) {
            // Vant UI — ensure all components are kept (prevent tree-shaking)
            if (id.includes('node_modules/vant')) {
              return 'vendor-vant'
            }
            // Supabase SDK — separate from entry chunk (P-03)
            if (id.includes('@supabase/supabase-js')) {
              return 'vendor-supabase'
            }
            // Markdown processing libs (P-04)
            if (id.includes('marked') || id.includes('dompurify')) {
              return 'vendor-markdown'
            }
            // Lunar calendar — heavy dep only used by TaskCalendar (P-05)
            if (id.includes('lunar-javascript')) {
              return 'vendor-lunar'
            }
            // Vue core + Pinia — separate from Tiptap to keep entry chunk lean
            if (
              id.includes('node_modules/vue/') ||
              id.includes('node_modules/@vue/') ||
              id.includes('node_modules/pinia/')
            ) {
              return 'vendor-vue'
            }
            if (id.includes('prosemirror')) {
              return 'vendor-prosemirror'
            }
            if (
              id.includes('@tiptap/extension-table') ||
              id.includes('@tiptap/extension-table-row') ||
              id.includes('@tiptap/extension-table-header') ||
              id.includes('@tiptap/extension-table-cell')
            ) {
              return 'vendor-tiptap-table'
            }
            if (
              id.includes('@tiptap/extension-task-list') ||
              id.includes('@tiptap/extension-task-item')
            ) {
              return 'vendor-tiptap-task'
            }
            if (
              id.includes('@tiptap') ||
              id.includes('tiptap-extension-resize-image')
            ) {
              return 'vendor-tiptap-core'
            }
          }
          // NOTE: src/extensions/ files are NOT force-chunked — they import from
          // @/stores/memo which lives in the entry chunk. Forcing them into a
          // separate chunk creates a circular dependency that Rollup resolves by
          // pulling Tiptap into the entry chunk. Letting them bundle naturally
          // with RichTextEditor (lazy-loaded) avoids this entirely.
        },
      },
    },
  },
})
