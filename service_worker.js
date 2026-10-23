const CACHE_NAME = 'smoking-simulator-v1';

// Archivos estáticos principales que se guardarán en caché durante la instalación
const INITIAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icono_smoking_simulator.png'
];

// Instalación del Service Worker: guarda los archivos básicos en la memoria caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(INITIAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker: elimina cachés obsoletas si actualizas el juego
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
    }).then(() => self.clients.claim())
  );
});

// Intercepción de solicitudes de red: Prioriza la caché y guarda recursos externos (fuentes, etc.)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Si la respuesta de red es válida, la clonamos y guardamos en caché dinámicamente
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback offline si navega directamente a la raíz
          if (event.request.mode === 'navigate') {
            return caches.match('./') || caches.match('./index.html');
          }
        });
    })
  );
});