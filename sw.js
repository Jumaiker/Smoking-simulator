/* Smoking Simulator — service worker
   Guarda el juego en el dispositivo para jugar sin conexión.
   El index.html se pide primero a internet (así ves siempre la última versión
   que subas) y, si no hay conexión, se usa la copia guardada.
   Si cambias iconos u otros archivos y quieres forzar la actualización,
   sube el número de VERSION. */
const VERSION = 'smoking-sim-v2';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon-16.png',
  './favicon-32.png',
  './favicon-48.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';

async function cacheFonts(cache) {
  try {
    const res = await fetch(FONT_CSS, { mode: 'cors' });
    if (!res.ok) return;
    await cache.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && cache.put(u, r)).catch(() => {})));
  } catch (e) { /* sin conexión al instalar: se guardarán en la próxima visita */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await cacheFonts(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Página: primero internet (máx. 4 s), si no, la copia guardada
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Fuentes de Google: copia guardada primero
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req.url, res.clone()); return res; }
      catch (e) { return Response.error(); }
    })());
    return;
  }

  // Resto de archivos del juego: respuesta inmediata desde la copia y se actualiza por detrás
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
