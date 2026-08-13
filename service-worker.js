const CACHE_NAME = 'partners-board-v2';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './pwa-icon-192.png',
  './pwa-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// PWA 설치 요건 충족용 fetch 리스너.
// 외부 API 및 POST 요청 간섭을 막기 위해 브라우저가 네트워크 요청을 직접 처리하도록 양보(Pass-through)합니다.
self.addEventListener('fetch', (event) => {
  // Do nothing
});
