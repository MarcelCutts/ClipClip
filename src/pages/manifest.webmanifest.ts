import type { APIRoute } from 'astro';
import { href } from '../lib/url';

/**
 * The web app manifest: what a phone needs to keep the guide on its Home Screen as an app of its own.
 * On an iPhone that matters for the saved copy: Safari removes a tab's saved data after a week
 * without a visit, and a Home Screen web app is exempt (OfflineGuide.astro). The app opens inside the
 * guide's own address, wherever the site is deployed, and the offline package includes this file
 * (scripts/offline.ts).
 *
 * The colours are the night's page (--paper in the dark theme, tokens.css): a white screen at the
 * moment the app opens would glare in a booth. A page's own theme-color still follows the reader's
 * setting (Base.astro).
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: 'Out of the red',
      short_name: 'Out of the red',
      description: 'Keep DJ set recordings clean: what the meters should show, and the crew’s checklists.',
      lang: 'en-GB',
      id: href('/'),
      start_url: href('/'),
      scope: href('/'),
      display: 'standalone',
      background_color: '#0a0c0e',
      theme_color: '#0a0c0e',
      icons: [
        { src: href('/icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: href('/icon-512.png'), sizes: '512x512', type: 'image/png' },
        { src: href('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } },
  );
