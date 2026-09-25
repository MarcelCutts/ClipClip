import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { defineConfig, fontProviders } from 'astro/config';

// GitHub Pages serves a project site from /<repo>/. The deploy workflow passes the real origin
// and base path in; locally the site runs at the root.
const site = process.env.SITE_URL ?? 'http://localhost:4321';
const base = process.env.BASE_PATH ?? '/';

// Fonts are self-hosted from the installed Fontsource packages: no third-party requests.
// The site is English-only, so each face ships just its Latin file.
const fontsource = (pkg: string, file: string) => [`@fontsource-variable/${pkg}/files/${file}`] as [string];
const b612 = (variant: string) => [`@fontsource/b612/files/b612-latin-${variant}.woff2`] as [string];

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  // Astro 7 collapses whitespace with JSX rules by default, which glues words to links and
  // <strong> in prose written across lines. `true` keeps normal HTML whitespace.
  compressHTML: true,
  // The old addresses only forward to the guide and the tool pages, so they stay out of the sitemap.
  integrations: [
    svelte(),
    sitemap({ filter: (page) => !page.includes('/dev/') && !/\/(dj|crew|lab|why)\/$/.test(page) }),
  ],
  devToolbar: { enabled: false },
  fonts: [
    // B612, drawn for Airbus cockpit displays and made open by Airbus: the site reads like a
    // flight-deck quick reference handbook, so text, headings and the labs' readouts all use it.
    {
      provider: fontProviders.local(),
      name: 'B612',
      cssVariable: '--font-body',
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { src: b612('400-normal'), weight: '400', style: 'normal' },
          { src: b612('700-normal'), weight: '700', style: 'normal' },
          { src: b612('400-italic'), weight: '400', style: 'italic' },
        ],
      },
    },
    // Headings are B612 bold: the same file, under its own name so a component can ask for it.
    {
      provider: fontProviders.local(),
      name: 'B612 Headings',
      cssVariable: '--font-display',
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      options: {
        variants: [{ src: b612('700-normal'), weight: '700', style: 'normal' }],
      },
    },
    // Archivo at 75% width stays for the silk-screen lettering on the hardware panels: TRIM,
    // MASTER, CH1, as printed on the XDJ-RX2.
    {
      provider: fontProviders.local(),
      name: 'Archivo Labels',
      cssVariable: '--font-label',
      fallbacks: ['Arial Narrow', 'Helvetica Neue', 'sans-serif'],
      options: {
        variants: [
          {
            src: fontsource('archivo', 'archivo-latin-wdth-normal.woff2'),
            weight: '100 900',
            stretch: '75%',
            style: 'normal',
          },
        ],
      },
    },
    // Stencil lettering stays on the things that get printed and stuck on the gear.
    {
      provider: fontProviders.local(),
      name: 'Big Shoulders Stencil',
      cssVariable: '--font-stencil',
      fallbacks: ['Impact', 'Arial Narrow', 'sans-serif'],
      options: {
        variants: [
          {
            src: fontsource('big-shoulders-stencil', 'big-shoulders-stencil-latin-opsz-normal.woff2'),
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
  ],
});
