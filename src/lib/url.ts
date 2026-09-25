/** Prefix a site-relative path with the deploy base, so links work on a GitHub Pages project site. */
export function href(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
