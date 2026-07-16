// CleanNotes Mobile PWA Service Worker
// v3: 改进缓存策略，预缓存 app shell，减少白屏

const CACHE_NAME = 'cleannotes-mobile-v1.3.0-r16';
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

  // Navigation requests: 网络优先 → 缓存兜底（减少白屏）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./mobile.html', clone));
          return response;
        })
        .catch(() => caches.match('./mobile.html'))
    );
    return;
  }

  // 静态资源（JS/CSS/字体/图片）：缓存优先 → 网络更新（stale-while-revalidate）
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') ||
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.svg') ||
       url.pathname.endsWith('.png') ||
       url.pathname.endsWith('.woff2') ||
       url.pathname.endsWith('.woff'))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 其他同源请求：网络优先 → 缓存兜底
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
