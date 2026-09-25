import { afterEach, describe, expect, it, vi } from 'vitest';

describe('href', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('joins paths onto a root deploy', async () => {
    vi.stubEnv('BASE_URL', '/');
    const { href } = await import('./url');
    expect(href('/dj/')).toBe('/dj/');
    expect(href('crew/')).toBe('/crew/');
    expect(href()).toBe('/');
  });

  it('joins paths onto a GitHub Pages project site, with or without a trailing slash', async () => {
    vi.stubEnv('BASE_URL', '/ClipClip');
    let { href } = await import('./url');
    expect(href('/dj/')).toBe('/ClipClip/dj/');
    vi.resetModules();
    vi.stubEnv('BASE_URL', '/ClipClip/');
    ({ href } = await import('./url'));
    expect(href('/og.png')).toBe('/ClipClip/og.png');
    expect(href('/')).toBe('/ClipClip/');
  });
});
