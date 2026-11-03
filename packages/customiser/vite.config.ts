import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * THE FILES THE BUILD WRITES, AND THE NAMES THE MANIFEST AND THE APPS USE.
 *
 * Two kinds of file, built differently because two different places load them:
 *
 * - `pages`: the shop's own screens in the dashboard, one file each, every
 *   language inside, the host's React reached through the published shims
 *   (as every add-on's screens are). None is written yet: the shop's set-up
 *   and its design editor add theirs here, and the manifest names each.
 * - `browser`: the customer's editor. It is not served by Adminium at all: a
 *   shop app imports `@adminiumjs/add-on-customiser/browser` into its own
 *   customer bundle, at the range it pins, so React stays the app's own and
 *   is left out of this file.
 *
 * `manifest.test.ts` holds the manifest to `OUTPUT.pages`; `dist.test.ts`
 * holds what lands on disk to `BUILT_FILES`.
 */
export const OUTPUT = {
  pages: {} as Readonly<Record<string, string>>,
  browser: 'dist/browser/index.js',
} as const;

/** Every file the build writes. */
export const BUILT_FILES: readonly string[] = [OUTPUT.browser, ...Object.values(OUTPUT.pages)];

/**
 * The host's own copies of React and the dashboard's parts, for the shop's
 * screens: found the way Node finds them from this package.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);

/** The shop's screens, one file each, built after the customer's editor in the same `vite build`. */
function screens(): Plugin {
  return {
    name: 'add-on-customiser:screens',
    apply: 'build',
    async closeBundle() {
      for (const file of Object.values(OUTPUT.pages)) {
        const name = file.slice('dist/pages/'.length, -'.js'.length);
        await build({
          configFile: false,
          logLevel: 'warn',
          plugins: [react()],
          resolve: {
            alias: [
              { find: /^react\/jsx-dev-runtime$/, replacement: shim('jsx-runtime') },
              { find: /^react\/jsx-runtime$/, replacement: shim('jsx-runtime') },
              { find: /^react-dom$/, replacement: shim('react-dom') },
              { find: /^react$/, replacement: shim('react') },
            ],
          },
          build: {
            // The customer's editor is already in `dist/`: emptying it here would delete it.
            emptyOutDir: false,
            outDir: 'dist/pages',
            lib: { entry: `src/pages/${name}/index.tsx`, formats: ['es'], fileName: () => `${name}.js` },
            rollupOptions: { external: [], output: { inlineDynamicImports: true } },
            target: 'es2022',
            sourcemap: false,
          },
        });
      }
    },
  };
}

export default defineConfig(({ mode }) =>
  mode === 'test'
    ? {
        test: {
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          setupFiles: ['src/pages/testing/host.tsx'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          fileParallelism: false,
        },
      }
    : {
        plugins: [react(), screens()],
        build: {
          outDir: 'dist',
          emptyOutDir: true,
          lib: { entry: 'src/browser/index.ts', formats: ['es'], fileName: () => 'browser/index.js' },
          rollupOptions: {
            // The app that imports the editor brings React; its bundle holds the one copy.
            external: [/^react($|\/)/, /^react-dom($|\/)/],
          },
          target: 'es2022',
          /*
           * NO SOURCEMAP. A map is a file nobody names, and it would carry the
           * sources' own comments into a package whose every byte is swept for
           * words that may not ship.
           */
          sourcemap: false,
        },
      },
);
