// Renders the share image (public/og.png), the ten-second chat clip (public/media/*) and the home-screen
// icon (public/apple-touch-icon.png) from the HTML pages in this folder, using the site's own fonts and
// tokens (src/styles/tokens.css). The pages are drawn as the cockpit display, so they render in the dark
// scheme. The icon is public/favicon.svg drawn at 180 px on the hardware black, without its rounded
// corners, because iOS rounds them itself. Needs Chromium (pnpm exec playwright install chromium) and
// ffmpeg on the PATH.
//
//   node scripts/media/render.mjs          # all three
//   node scripts/media/render.mjs og       # just the share image (or clip, or icon)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = join(import.meta.dirname, '..', '..');
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.js': 'text/javascript',
};
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

/** Opens one of the pages in this folder at its own size, in the dark scheme, with its fonts loaded. */
async function open(file, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'dark' });
  await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

if (!only || only === 'og') {
  const page = await open('og.html', 1200, 630);
  await page.screenshot({ path: join(root, 'public', 'og.png') });
  console.log('wrote public/og.png');
}

if (!only || only === 'icon') {
  const page = await open('icon.html', 180, 180);
  await page.screenshot({ path: join(root, 'public', 'apple-touch-icon.png') });
  console.log('wrote public/apple-touch-icon.png');
}

if (!only || only === 'clip') {
  const fps = 15;
  const seconds = 11.5;
  const frames = mkdtempSync(join(tmpdir(), 'clip-'));
  const page = await open('clip.html', 1080, 1080);
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
  // The poster is the last second: the tape is up and the tops are still flat.
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
