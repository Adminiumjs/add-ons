import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * ONE FILE, AND THE NAME THE MANIFEST GIVES IT.
 *
 * Live chat runs no code of its own on a server: Adminium keeps every
 * conversation, serves the visitor's window and writes every message. What
 * this builds is the staff screens, one page (`live-chat`) built from
 * `src/pages/chat/index.tsx` into one file. The manifest names it,
 * `manifest.test.ts` asserts it uses exactly this name and `dist.test.ts`
 * that it landed on disk.
 */
export const OUTPUT = {
  pages: {
    'live-chat': 'dist/pages/live-chat.js',
  },
} as const;

/** Every file the build writes, as the manifest names them. */
export const BUILT_FILES: readonly string[] = Object.values(OUTPUT.pages);

/**
 * WHAT IS NOT INLINED IS THE HOST. React and the dashboard's parts must be the
 * one running copy, so those specifiers are pointed at the published shims,
 * which read the host when the module loads.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);

// The comps' times are written in UTC: the screens' own tests read them there, wherever they run.
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
          lib: { entry: 'src/pages/chat/index.tsx', formats: ['es'], fileName: () => 'live-chat.js' },
          rollupOptions: { external: [], output: { inlineDynamicImports: true } },
          target: 'es2022',
          // No sourcemap: a map is a second file the manifest does not name.
          sourcemap: false,
        },
      },
);
