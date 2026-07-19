// CleanNotes Mobile PWA Service Worker
// v3: 改进缓存策略，预缓存 app shell，减少白屏

const CACHE_NAME = 'cleannotes-mobile-v1.3.0-r49';
const APP_SHELL = [
  './mobile.html',
  './manifest.json',
  './icon.svg',
];

// 静态资源缓存（JS/CSS/字体/图片）
const STATIC_CACHE = CACHE_NAME + '-static';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip Supabase API calls
  if (url.hostname.includes('supabase')) return;
  // Skip Open-Meteo / Nominatim (weather API)
  if (url.hostname.includes('open-meteo') || url.hostname.includes('nominatim')) return;

  // Navigation requests（HTML）：必须网络优先，确保每次加载最新构建（Vite hash 文件名）。
  // 网络失败时返回缓存只是为了离线可用；成功时更新缓存。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (!response.ok) throw new Error('navigation failed');
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./mobile.html', clone));
          return response;
        })
        .catch(() => caches.match('./mobile.html'))
    );
    return;
  }

  // 静态资源（JS/CSS/字体/图片）：网络优先 → 缓存兜底
  // 文件名已带 Vite hash，新构建会自然失效旧缓存。
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') ||
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.svg') ||
       url.pathname.endsWith('.png') ||
       url.pathname.endsWith('.woff2') ||
       url.pathname.endsWith('.woff'))) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // 其他同源请求：网络优先 → 缓存兜底
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
