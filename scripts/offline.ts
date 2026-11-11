import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { OFFLINE_WORKER } from '../src/lib/offline-worker';

/** Every kind of file the site ships. A file of another kind stops the build (below). */
const SAVED_TYPES = /\.(html|js|css|woff2?|svg|png|jpg|ico|mp4|webmanifest)$/;

/** Built files the saved guide leaves out: the worker itself, and what only crawlers read. */
const notSaved = (file: string) => file === 'sw.js' || file === 'robots.txt' || /^sitemap-[\w-]+\.xml$/.test(file);

/** Build the saved package from the actual output, including every island and local font. */
export function offlineGuide(base: string): AstroIntegration {
  return {
    name: 'offline-guide',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const prefix = `/${base.split('/').filter(Boolean).join('/')}${base === '/' ? '' : '/'}`;
        const entries = await readdir(root, { recursive: true, withFileTypes: true });
        const files = entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(entry.parentPath, entry.name)))
          .filter((file) => !file.startsWith('dev/') && !notSaved(file))
          .sort();
        // A new kind of file must be a decision, not a silent gap in the saved guide.
        const unknown = files.filter((file) => !SAVED_TYPES.test(file));
        if (unknown.length) {
          throw new Error(
            `The offline package does not know these files: ${unknown.join(', ')}. Add their type to SAVED_TYPES, or leave them out in notSaved (scripts/offline.ts).`,
          );
        }
        const hash = createHash('sha256');
        const integrity: Record<string, string> = {};
        const address = (file: string) => `${prefix}${file.replace(/(^|\/)index\.html$/, '$1')}`;
        for (const file of files) {
          hash.update(file);
          const bytes = await readFile(join(root, file));
          hash.update(bytes);
          integrity[address(file)] = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
        }
        const version = hash.digest('hex').slice(0, 12);
        const config = {
          base: prefix,
          version,
          prefix: `out-of-the-red:${prefix}:`,
          urls: files.map(address),
          integrity,
        };
        await writeFile(join(root, 'sw.js'), `const CONFIG = ${JSON.stringify(config)};\n${OFFLINE_WORKER}`);
        logger.info(`Offline package ${version}: ${files.length} files, including fonts, demos and clip.`);
      },
    },
  };
}
