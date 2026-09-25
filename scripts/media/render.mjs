// Renders the share image (public/og.png) and the ten-second chat clip (public/media/*) from the
// HTML pages in this folder, using the site's own fonts. Needs Chromium (pnpm exec playwright
// install chromium) and ffmpeg on the PATH.
//
//   node scripts/media/render.mjs          # both
//   node scripts/media/render.mjs og       # just the share image
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = join(import.meta.dirname, '..', '..');
const types = { '.html': 'text/html', '.woff2': 'font/woff2', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}/scripts/media`;
const only = process.argv[2];
const browser = await chromium.launch();

if (!only || only === 'og') {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`${base}/og.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public', 'og.png') });
  console.log('wrote public/og.png');
}

if (!only || only === 'clip') {
  const fps = 15;
  const seconds = 11.5;
  const frames = mkdtempSync(join(tmpdir(), 'clip-'));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.goto(`${base}/clip.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const n = Math.round(fps * seconds);
  for (let i = 0; i < n; i++) {
    // clip.html defines window.frame(t), which draws the frame at t seconds.
    await page.evaluate((t) => /** @type {Window & { frame(t: number): void }} */ (window).frame(t), i / fps);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`) });
  }
  const out = join(root, 'public', 'media');
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-framerate',
    String(fps),
    '-i',
    join(frames, 'f%04d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    '-vf',
    'scale=720:720',
    join(out, 'turn-it-down.mp4'),
  ]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    join(frames, `f${String(n - 13).padStart(4, '0')}.png`),
    '-vf',
    'scale=720:720',
    join(out, 'turn-it-down-poster.jpg'),
  ]);
  rmSync(frames, { recursive: true, force: true });
  console.log(`wrote public/media/turn-it-down.mp4 (${n} frames) and its poster`);
}

await browser.close();
server.close();
