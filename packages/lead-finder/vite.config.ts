import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * THREE BUILT FILES, AND THE NAMES THE MANIFEST GIVES THEM.
 *
 *  - `dist/server.js`: the server half (`lead-source@1`), self-contained ES
 *    for the engine's `import()`, with no sourcemap. The activity lists a
 *    source labels its codes with are inlined into it. (`vite build`)
 *  - `dist/pages/lead-finder.js`: the staff screens, one page (`lead-finder`):
 *    Find companies, People found, and the settings (Sources, People).
 *    (`vite build --mode pages`)
 *  - `dist/client.js`: the `record.actions` fill, "Fill in details" on a
 *    company's record: the sheet's content. (`vite build --mode client`)
 *
 * Three builds rather than three entries of one: each file stands alone,
 * with no chunk shared between them, as the engine loads each by itself.
 * `manifest.test.ts` asserts the manifest uses exactly these names and
 * `dist.test.ts` that they landed on disk.
 */
export const OUTPUT = {
  server: 'dist/server.js',
  pages: { 'lead-finder': 'dist/pages/lead-finder.js' },
  client: 'dist/client.js',
} as const;

export const BUILT_FILES: readonly string[] = [OUTPUT.server, ...Object.values(OUTPUT.pages), OUTPUT.client];

/**
 * WHAT IS NOT INLINED IN THE SCREENS IS THE HOST. React and the dashboard's
 * parts must be the one running copy, so those specifiers are pointed at the
 * published shims, which read the host when the module loads.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);
const HOST_ALIASES = [
  { find: /^react\/jsx-dev-runtime$/, replacement: shim('jsx-runtime') },
  { find: /^react\/jsx-runtime$/, replacement: shim('jsx-runtime') },
  { find: /^react-dom$/, replacement: shim('react-dom') },
  { find: /^react$/, replacement: shim('react') },
];

// The screens' tests read dates in UTC, wherever they run.
if (process.env['VITEST'] !== undefined) process.env['TZ'] = 'UTC';

export default defineConfig(({ mode }) => {
  if (mode === 'test') {
    return {
      test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        setupFiles: ['src/pages/testing/host.tsx'],
        exclude: ['**/node_modules/**'],
        testTimeout: 120_000,
        fileParallelism: false,
      },
    };
  }
  if (mode === 'pages' || mode === 'client') {
    const pages = mode === 'pages';
    return {
      plugins: [react()],
      resolve: { alias: HOST_ALIASES },
      build: {
        outDir: pages ? 'dist/pages' : 'dist',
        // The server half is already in `dist/`: only the pages' own folder is emptied.
        emptyOutDir: pages,
        lib: pages
          ? { entry: 'src/pages/finder/index.tsx', formats: ['es'], fileName: () => 'lead-finder.js' }
          : { entry: 'src/pages/fill/client.tsx', formats: ['es'], fileName: () => 'client.js' },
        rollupOptions: { external: [], output: { inlineDynamicImports: true } },
        target: 'es2022',
        // No sourcemap: a map is a second file the manifest does not name.
        sourcemap: false,
      },
    };
  }
  return {
    build: {
      lib: { entry: 'src/server.ts', formats: ['es'], fileName: () => 'server.js' },
      rollupOptions: { external: [] },
      target: 'es2022',
      sourcemap: false,
      minify: false,
    },
  };
});
