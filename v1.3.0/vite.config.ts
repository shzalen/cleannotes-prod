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
  base: '/',
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
      output: {
        manualChunks(id) {
          // Split heavy editor dependencies by functional group for finer-grained loading
          if (id.includes('node_modules')) {
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
              id.includes('@tiptap/extension-mention') ||
              id.includes('@tiptap/suggestion')
            ) {
              return 'vendor-tiptap-mention'
            }
            if (
              id.includes('@tiptap') ||
              id.includes('tiptap-extension-resize-image')
            ) {
              return 'vendor-tiptap-core'
            }
          }
          // Isolate custom extensions to avoid bloating individual views
          if (id.includes('/src/extensions/')) {
            return 'vendor-tiptap-custom'
          }
        },
      },
    },
  },
})
