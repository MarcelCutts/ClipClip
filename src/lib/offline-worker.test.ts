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

function worker(caches: ReturnType<typeof storage>, version = 'v1', fail = false) {
  const handlers = new Map<string, (event: object) => void>();
  const claim = vi.fn();
  const skipWaiting = vi.fn();
  let downloads = 0;
  const fetch = vi.fn(async () => {
    if (fail && downloads++ === 1) return new Response('unavailable', { status: 503 });
    return new Response(version);
  });
  runInNewContext(OFFLINE_WORKER, {
    CONFIG: {
      base: '/ClipClip/',
      version,
      prefix: 'out-of-the-red:/ClipClip/:',
      urls: ['/ClipClip/', '/ClipClip/night/', '/ClipClip/_astro/font.woff2'],
    },
    self: {
      location: { origin: 'https://guide.test' },
      clients: { claim },
      skipWaiting,
      addEventListener: (name: string, fn: (e: object) => void) => handlers.set(name, fn),
    },
    URL,
    Request,
    Response,
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
  const status = async () => {
    let value: { ready: boolean; version: string } | undefined;
    await fire('message', {
      data: 'OFFLINE_STATUS',
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
  return { fire, status, fetch, claim, skipWaiting };
}

describe('complete, versioned offline packages', () => {
  it('reports ready only after every page and dependency is saved; notices eviction', async () => {
    const caches = storage();
    const current = worker(caches);
    expect((await current.status())?.ready).toBe(false);
    await current.fire('install');
    expect(current.fetch).toHaveBeenCalledTimes(3);
    expect(await current.status()).toEqual({ ready: true, version: 'v1' });
    caches.data.get('out-of-the-red:/ClipClip/:v1')!.delete('https://guide.test/ClipClip/_astro/font.woff2');
    expect((await current.status())?.ready).toBe(false);
    await current.fire('message', { data: 'OFFLINE_REPAIR', ports: [{ postMessage: vi.fn() }] });
    expect((await current.status())?.ready).toBe(true);
  });

  it('a failed update leaves the previous package usable', async () => {
    const caches = storage();
    const previous = worker(caches);
    await previous.fire('install');
    const update = worker(caches, 'v2', true);
    await expect(update.fire('install')).rejects.toThrow('Incomplete');
    expect((await update.status())?.ready).toBe(false);
    expect((await previous.status())?.ready).toBe(true);
    expect(await caches.keys()).toEqual(['out-of-the-red:/ClipClip/:v1']);
    const response = (await previous.fire('fetch', {
      request: new Request('https://guide.test/ClipClip/night?test=1'),
    })) as Response;
    expect(await response.text()).toBe('v1');
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
