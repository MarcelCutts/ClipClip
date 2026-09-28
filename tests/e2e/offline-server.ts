import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

/** A built deployment that tests can disconnect, restart, and update independently. */
export async function serveBuiltGuide() {
  const worker = await readFile('dist/sw.js', 'utf8');
  const config = JSON.parse(worker.split('\n')[0]!.slice('const CONFIG = '.length, -1)) as {
    base: string;
    version: string;
    integrity: Record<string, string>;
  };
  const files = new Map<string, string>();
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname;
    if (!pathname.startsWith(config.base)) {
      response.writeHead(404).end();
      return;
    }
    const file = pathname.slice(config.base.length).replace(/\/$/, '/index.html') || 'index.html';
    try {
      const body = files.get(file) ?? (await readFile(join('dist', file)));
      response
        .writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  let port = 0;
  async function start() {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    port = address.port;
  }
  async function stop() {
    if (!server.listening) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await start();
  return { url: `http://127.0.0.1:${port}${config.base}`, worker, config, files, start, stop };
}
