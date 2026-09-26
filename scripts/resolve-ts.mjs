// Lets Node run the site's TypeScript modules straight from src/. They import one another without
// file extensions, as Vite allows, so this tries ".ts" when a relative import has no extension.
//
//   node --import ./scripts/resolve-ts.mjs scripts/clipcheck.ts …
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // Not a TypeScript file: resolve it as written.
      }
    }
    return nextResolve(specifier, context);
  },
});
