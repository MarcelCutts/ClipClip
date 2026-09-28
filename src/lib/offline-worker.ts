/** Classic worker source. CONFIG is injected from the build's complete asset inventory. */
export const OFFLINE_WORKER = String.raw`
const CACHE = CONFIG.prefix + CONFIG.version;
const READY = new URL(CONFIG.base + '__offline_ready__', self.location.origin).href;
const absolute = (url) => new URL(url, self.location.origin).href;
const URLS = CONFIG.urls.map(absolute);
const INCLUDED = new Set(URLS);

async function saved() {
  if (!(await caches.has(CACHE))) return false;
  const cache = await caches.open(CACHE);
  if (!(await cache.match(READY))) return false;
  for (const url of URLS) if (!(await cache.match(url))) return false;
  return true;
}

async function save() {
    if (await saved()) return;
    const cache = await caches.open(CACHE);
    try {
      // The ready marker is written only after every response has been checked and saved.
      // Sequential requests avoid a burst of connections on a poor mobile connection.
      for (const url of URLS) {
        const response = await fetch(new Request(url, { cache: 'reload', integrity: CONFIG.integrity?.[new URL(url).pathname] }));
        if (!response.ok || response.type === 'opaque') throw new Error('Incomplete offline package');
        await cache.put(url, response);
      }
      await cache.put(READY, new Response(CONFIG.version));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
}
self.addEventListener('install', (event) => {
  // Deliberately no skipWaiting: an open event keeps its current version.
  event.waitUntil(save());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (!(await saved())) throw new Error('Offline package missing');
    for (const name of await caches.keys()) {
      if (name.startsWith(CONFIG.prefix) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (!event.ports[0]) return;
  if (event.data === 'OFFLINE_REPAIR') {
    event.waitUntil(save().then(
      () => event.ports[0].postMessage({ ready: true, version: CONFIG.version }),
      () => event.ports[0].postMessage({ ready: false, version: CONFIG.version })
    ));
    return;
  }
  if (event.data !== 'OFFLINE_STATUS') return;
  event.waitUntil(saved().then((ready) => event.ports[0].postMessage({ ready, version: CONFIG.version })));
});

function canonical(raw) {
  const url = new URL(raw);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(CONFIG.base)) return null;
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/index\.html$/, '/');
  if (!INCLUDED.has(url.href) && INCLUDED.has(url.href + '/')) return url.href + '/';
  return INCLUDED.has(url.href) ? url.href : null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const key = canonical(event.request.url);
  if (!key) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(key)) || fetch(event.request);
  })());
});
`;
