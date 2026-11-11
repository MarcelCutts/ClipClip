/** Classic worker source. CONFIG is injected from the build's complete asset inventory. */
export const OFFLINE_WORKER = String.raw`
const CACHE = CONFIG.prefix + CONFIG.version;
const READY = new URL(CONFIG.base + '__offline_ready__', self.location.origin).href;
const absolute = (url) => new URL(url, self.location.origin).href;
const URLS = CONFIG.urls.map(absolute);
const INCLUDED = new Set(URLS);

const NOT_FOUND = absolute(CONFIG.base + '404.html');

// The package is complete when its ready marker and every file are in the cache. The marker holds
// the time the package was completed, so the page can say how old the copy is.
async function saved() {
  if (!(await caches.has(CACHE))) return null;
  const cache = await caches.open(CACHE);
  const marker = await cache.match(READY);
  if (!marker) return null;
  for (const url of URLS) if (!(await cache.match(url))) return null;
  const record = await marker.json().catch(() => null);
  return { savedAt: typeof record?.savedAt === 'number' ? record.savedAt : null };
}

const status = async () => {
  const complete = await saved();
  return { ready: Boolean(complete), version: CONFIG.version, savedAt: complete ? complete.savedAt : null };
};

// Downloads the package. A repair is the same job on the package the reader already has, after the
// browser removed some of it. (No backticks in this file's worker source: it is one template string.)
async function save(repair) {
  if (await saved()) return;
  const cache = await caches.open(CACHE);
  try {
    // The ready marker is written only after every response has been checked and saved.
    // Sequential requests avoid a burst of connections on a poor mobile connection.
    for (const url of URLS) {
      // A repair fetches only what is missing: a file still in the cache passed its integrity check
      // when it arrived.
      if (repair && (await cache.match(url))) continue;
      const response = await fetch(new Request(url, { cache: 'reload', integrity: CONFIG.integrity?.[new URL(url).pathname] }));
      if (!response.ok || response.type === 'opaque') throw new Error('Incomplete offline package');
      await cache.put(url, response);
    }
    await cache.put(READY, new Response(JSON.stringify({ savedAt: Date.now() })));
  } catch (error) {
    // A repair that fails deletes nothing: on one bar of signal, the pages still in the cache may be
    // every page the reader has. A new download that fails is removed whole, and the next try starts
    // again. It cannot carry on from what arrived: after a failed install, Safari's engine shows the
    // next worker cache entries that it did not keep, so a download that skipped them wrote the ready
    // marker over a package with 43 of 55 files missing (Playwright's WebKit, November 2026).
    if (!repair) await caches.delete(CACHE);
    throw error;
  }
}
self.addEventListener('install', (event) => {
  // Deliberately no skipWaiting: an open event keeps its current version.
  event.waitUntil(save(false));
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
    event.waitUntil(save(true).then(status, status).then((state) => event.ports[0].postMessage(state)));
    return;
  }
  if (event.data !== 'OFFLINE_STATUS') return;
  event.waitUntil(status().then((state) => event.ports[0].postMessage(state)));
});

const inGuide = (url) => url.origin === self.location.origin && url.pathname.startsWith(CONFIG.base);

function canonical(raw) {
  const url = new URL(raw);
  if (!inGuide(url)) return null;
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/index\.html$/, '/');
  if (!INCLUDED.has(url.href) && INCLUDED.has(url.href + '/')) return url.href + '/';
  return INCLUDED.has(url.href) ? url.href : null;
}

// Safari asks for a video a range of bytes at a time, and does not play a whole file sent in
// reply. A request with one range gets that part of the saved file, as a server would send it.
async function part(stored, header) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!range || (range[1] === '' && range[2] === '')) return stored;
  const bytes = await stored.arrayBuffer();
  const size = bytes.byteLength;
  const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
  const end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
  const headers = new Headers(stored.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  if (start > end) {
    headers.set('Content-Range', 'bytes */' + size);
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers });
  }
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const key = canonical(request.url);
  if (key) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const stored = await cache.match(key);
      if (!stored) return fetch(request);
      const range = request.headers.get('Range');
      return range ? part(stored, range) : stored;
    })());
    return;
  }
  // An address inside the guide that is not one of its pages, such as a mistyped one: the network
  // answers if there is one. With no connection, the reader gets the guide's own "nothing here"
  // page and its links, not the browser's error.
  if (request.mode !== 'navigate' || !inGuide(new URL(request.url)) || !INCLUDED.has(NOT_FOUND)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    const page = await cache.match(NOT_FOUND);
    if (!page) return Response.error();
    return new Response(page.body, { status: 404, statusText: 'Not Found', headers: page.headers });
  }));
});
`;
