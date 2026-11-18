import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * ONE FILE, AND THE NAME THE MANIFEST GIVES IT.
 *
 * Landing pages runs no code of its own for a stranger: Adminium draws every
 * live page, writes its head, serves its pictures and counts its views. What
 * this builds is the staff screens, one page (`pages`) built from
 * `src/pages/landing/index.tsx` into one file: the list, the funnels and the
 * editor. The manifest names it, `manifest.test.ts` asserts it uses exactly
 * this name and `dist.test.ts` that it landed on disk.
 */
export const OUTPUT = {
  pages: {
    pages: 'dist/pages/pages.js',
  },
} as const;

/** Every file the build writes, as the manifest names them. */
export const BUILT_FILES: readonly string[] = Object.values(OUTPUT.pages);

/**
 * WHAT IS NOT INLINED IS THE HOST. React and the dashboard's parts must be the
 * one running copy, so those specifiers are pointed at the published shims,
 * which read the host when the module loads. The landing renderer from the
 * contracts imports only React, so it is drawn with the host's React too.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);

// The comps' days are written in UTC: the screens' own tests read them there, wherever they run.
if (process.env['VITEST'] !== undefined) process.env['TZ'] = 'UTC';

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
          outDir: 'dist/pages',
          emptyOutDir: true,
          lib: { entry: 'src/pages/landing/index.tsx', formats: ['es'], fileName: () => 'pages.js' },
          rollupOptions: { external: [], output: { inlineDynamicImports: true } },
          target: 'es2022',
          // No sourcemap: a map is a second file the manifest does not name.
          sourcemap: false,
        },
      },
);
