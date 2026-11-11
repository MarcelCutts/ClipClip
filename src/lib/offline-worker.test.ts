import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { OFFLINE_WORKER } from './offline-worker';

function storage() {
  const data = new Map<string, Map<string, Response>>();
  return {
    data,
    has: async (name: string) => data.has(name),
    keys: async () => [...data.keys()],
    delete: async (name: string) => data.delete(name),
    open: async (name: string) => {
      if (!data.has(name)) data.set(name, new Map());
      const cache = data.get(name)!;
      return {
        match: async (key: string) => cache.get(key)?.clone(),
        put: async (key: string, value: Response) => {
          cache.set(key, value.clone());
        },
      };
    },
  };
}

const ORIGIN = 'https://guide.test';
const URLS = ['/ClipClip/', '/ClipClip/404.html', '/ClipClip/night/', '/ClipClip/_astro/font.woff2'];
const V1 = 'out-of-the-red:/ClipClip/:v1';

interface Net {
  /** Fail the download with this number (from 0), once. */
  failAt?: number;
  /** No connection: every request rejects, as the browser's does. */
  offline?: boolean;
}

function worker(caches: ReturnType<typeof storage>, version = 'v1', net: Net = {}) {
  const handlers = new Map<string, (event: object) => void>();
  const claim = vi.fn();
  const skipWaiting = vi.fn();
  let downloads = 0;
  const fetch = vi.fn(async () => {
    if (net.offline) throw new TypeError('Failed to fetch');
    if (downloads++ === net.failAt) return new Response('unavailable', { status: 503 });
    return new Response(version);
  });
  runInNewContext(OFFLINE_WORKER, {
    CONFIG: { base: '/ClipClip/', version, prefix: 'out-of-the-red:/ClipClip/:', urls: URLS },
    self: {
      location: { origin: ORIGIN },
      clients: { claim },
      skipWaiting,
      addEventListener: (name: string, fn: (e: object) => void) => handlers.set(name, fn),
    },
    URL,
    Request,
    Response,
    Headers,
    fetch,
    caches,
  });
  const fire = async (name: string, event = {}) => {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)?.({
      ...event,
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
      respondWith: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    return pending;
  };
  const ask = async (data: 'OFFLINE_STATUS' | 'OFFLINE_REPAIR') => {
    let value: { ready: boolean; version: string; savedAt: number | null } | undefined;
    await fire('message', {
      data,
      ports: [
        {
          postMessage: (v: typeof value) => {
            value = v;
          },
        },
      ],
    });
    return value;
  };
  const status = () => ask('OFFLINE_STATUS');
  const repair = () => ask('OFFLINE_REPAIR');
  /** What the worker answers to a request, or nothing when it leaves the request to the browser. */
  const get = (path: string, init: { range?: string; mode?: string } = {}) =>
    fire('fetch', {
      request: {
        method: 'GET',
        url: `${ORIGIN}${path}`,
        mode: init.mode ?? 'no-cors',
        headers: new Headers(init.range ? { Range: init.range } : {}),
      },
    }) as Promise<Response | undefined>;
  return { fire, status, repair, get, fetch, claim, skipWaiting, net };
}

describe('complete, versioned offline packages', () => {
  it('reports ready only after every page and dependency is saved; notices eviction', async () => {
    const caches = storage();
    const current = worker(caches);
    expect(await current.status()).toEqual({ ready: false, version: 'v1', savedAt: null });
    const before = Date.now();
    await current.fire('install');
    expect(current.fetch).toHaveBeenCalledTimes(URLS.length);
    const saved = await current.status();
    expect(saved).toEqual({ ready: true, version: 'v1', savedAt: expect.any(Number) });
    // The copy carries the time it was completed, so the page can say how old it is.
    expect(saved?.savedAt).toBeGreaterThanOrEqual(before);
    caches.data.get(V1)!.delete(`${ORIGIN}/ClipClip/_astro/font.woff2`);
    expect((await current.status())?.ready).toBe(false);
    expect((await current.repair())?.ready).toBe(true);
    // The repair fetched the one missing file, not the whole package again.
    expect(current.fetch).toHaveBeenCalledTimes(URLS.length + 1);
  });

  it('a failed update leaves the previous package usable, and removes what it had downloaded', async () => {
    const caches = storage();
    const previous = worker(caches);
    await previous.fire('install');
    const update = worker(caches, 'v2', { failAt: 1 });
    await expect(update.fire('install')).rejects.toThrow('Incomplete');
    expect((await update.status())?.ready).toBe(false);
    expect((await previous.status())?.ready).toBe(true);
    // The part of the new version that arrived is gone, so the next try downloads all of it. It must
    // not carry on from a failed install's cache: Safari's engine can show a worker entries from it
    // that were never kept (tests/e2e/offline-update.spec.ts runs this in WebKit).
    expect(await caches.keys()).toEqual([V1]);
    const response = await previous.get('/ClipClip/night?test=1');
    expect(await response?.text()).toBe('v1');
    expect(update.fetch).toHaveBeenCalledTimes(2);
    await update.fire('install');
    expect(update.fetch).toHaveBeenCalledTimes(2 + URLS.length);
    expect((await update.status())?.ready).toBe(true);
    expect((await previous.status())?.ready).toBe(true);
  });

  it('a repair that fails keeps every page it already had', async () => {
    const caches = storage();
    await worker(caches).fire('install');
    caches.data.get(V1)!.delete(`${ORIGIN}/ClipClip/_astro/font.woff2`);
    // One bar of signal: the missing file does not arrive.
    const weak = worker(caches, 'v1', { failAt: 0 });
    expect((await weak.repair())?.ready).toBe(false);
    expect(await caches.keys()).toEqual([V1]);
    for (const path of ['/ClipClip/', '/ClipClip/night/']) {
      expect(await (await weak.get(path))?.text()).toBe('v1');
    }
  });

  it('does not force an update into an open event, and only cleans this base path on activation', async () => {
    const caches = storage();
    await caches.open('out-of-the-red:/:other-guide');
    const previous = worker(caches);
    await previous.fire('install');
    const next = worker(caches, 'v2');
    await next.fire('install');
    expect(next.skipWaiting).not.toHaveBeenCalled();
    expect((await previous.status())?.ready).toBe(true);
    await next.fire('activate');
    expect(next.claim).toHaveBeenCalledOnce();
    expect(await caches.keys()).toEqual(['out-of-the-red:/:other-guide', 'out-of-the-red:/ClipClip/:v2']);
  });
});

describe('what the saved guide answers', () => {
  it('sends the asked part of a saved file, as Safari needs for a video', async () => {
    const caches = storage();
    const current = worker(caches);
    await current.fire('install');
    // Every saved file here is the two bytes "v1".
    const first = await current.get('/ClipClip/_astro/font.woff2', { range: 'bytes=0-0' });
    expect(first?.status).toBe(206);
    expect(first?.headers.get('Content-Range')).toBe('bytes 0-0/2');
    expect(await first?.text()).toBe('v');
    const rest = await current.get('/ClipClip/_astro/font.woff2', { range: 'bytes=1-' });
    expect(rest?.headers.get('Content-Range')).toBe('bytes 1-1/2');
    expect(await rest?.text()).toBe('1');
    const last = await current.get('/ClipClip/_astro/font.woff2', { range: 'bytes=-1' });
    expect(await last?.text()).toBe('1');
    const beyond = await current.get('/ClipClip/_astro/font.woff2', { range: 'bytes=0-99' });
    expect(beyond?.headers.get('Content-Range')).toBe('bytes 0-1/2');
    expect(await beyond?.text()).toBe('v1');
    const past = await current.get('/ClipClip/_astro/font.woff2', { range: 'bytes=5-' });
    expect(past?.status).toBe(416);
    expect(past?.headers.get('Content-Range')).toBe('bytes */2');
    // No range, or one this does not read: the whole file, as before.
    for (const range of [undefined, 'bytes=0-0,1-1', 'lines=1-2']) {
      const whole = await current.get('/ClipClip/_astro/font.woff2', range ? { range } : {});
      expect(whole?.status).toBe(200);
      expect(await whole?.text()).toBe('v1');
    }
  });

  it('with no connection, an address that is not a page gets the guide’s own “nothing here” page', async () => {
    const caches = storage();
    const current = worker(caches);
    await current.fire('install');
    current.net.offline = true;
    const missing = await current.get('/ClipClip/Night/', { mode: 'navigate' });
    expect(missing?.status).toBe(404);
    expect(await missing?.text()).toBe('v1');
    // Only pages: a missing image or script is left to the browser, and so is another site's page.
    expect(await current.get('/ClipClip/nope.png')).toBeUndefined();
    expect(await current.get('/elsewhere/', { mode: 'navigate' })).toBeUndefined();
    // With a connection the network answers, whatever it says.
    current.net.offline = false;
    const online = await current.get('/ClipClip/Night/', { mode: 'navigate' });
    expect(online?.status).toBe(200);
  });
});
