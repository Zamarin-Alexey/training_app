const CACHE_NAME = 'workout-app-cache-v1';

// Список файлов, которые браузер скачает сразу при первом заходе
const urlsToCache = [
  './',
  './index.html'
];

// При установке сервис-воркера кэшируем основные файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Удаляем старые кэши при активации
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия: Stale-While-Revalidate (Кэш + фоновое обновление)
self.addEventListener('fetch', event => {
  // Игнорируем запросы к расширениям Chrome и сторонним API (кроме нужных нам CDN)
  if (event.request.url.startsWith('chrome-extension') || event.request.url.includes('extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Если ресурс есть в кэше, сразу отдаем его пользователю (работает без интернета)
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Фоном обновляем кэш свежей версией из сети
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(err => {
        // Игнорируем ошибку сети (мы в офлайне, отдадим кэш)
        console.log('Офлайн режим, используем кэш для:', event.request.url);
      });

      // Отдаем кэш, если он есть, иначе ждем ответа из сети
      return cachedResponse || fetchPromise;
    })
  );
});
