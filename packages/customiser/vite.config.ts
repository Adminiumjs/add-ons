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
 *   (as every add-on's screens are), from `src/pages/<name>/index.tsx`;
 * - `panels`: the record panels on an app's product and order line, built
 *   the same way from `src/panels/<name>.tsx`, each a file of its own (a
 *   panel's file is served behind its own gates, never a page's);
 * - `browser`: the customer's editor. It is not served by Adminium at all: a
 *   shop app imports `@adminiumjs/add-on-customiser/browser` into its own
 *   customer bundle, at the range it pins, so React stays the app's own and
 *   is left out of this file.
 *
 * `manifest.test.ts` holds the manifest to `OUTPUT.pages`; `dist.test.ts`
 * holds what lands on disk to `BUILT_FILES`.
 */
export const OUTPUT = {
  pages: { customiser: 'dist/pages/customiser.js' } as Readonly<Record<string, string>>,
  panels: { 'customiser-product': 'dist/panels/product.js', 'customiser-line': 'dist/panels/line.js' } as Readonly<Record<string, string>>,
  browser: 'dist/browser/index.js',
} as const;

/** Every file the build writes. */
export const BUILT_FILES: readonly string[] = [OUTPUT.browser, ...Object.values(OUTPUT.pages), ...Object.values(OUTPUT.panels)];

/** Where each screen file is built from. */
const SCREENS: readonly { file: string; entry: string }[] = [
  ...Object.values(OUTPUT.pages).map((file) => ({ file, entry: `src/pages/${file.slice('dist/pages/'.length, -'.js'.length)}/index.tsx` })),
  ...Object.values(OUTPUT.panels).map((file) => ({ file, entry: `src/panels/${file.slice('dist/panels/'.length, -'.js'.length)}.tsx` })),
];

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
      for (const { file, entry } of SCREENS) {
        const name = file.slice(file.lastIndexOf('/') + 1, -'.js'.length);
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
            outDir: file.slice(0, file.lastIndexOf('/')),
            lib: { entry, formats: ['es'], fileName: () => `${name}.js` },
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
