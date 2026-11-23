import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * TWO FILES, AND THE NAMES THE MANIFEST GIVES THEM.
 *
 * `dist/frame.js` is the one script of the sandboxed page Adminium serves. It
 * is a classic script with everything inlined: the page has no origin of its
 * own and can import nothing. `dist/pages/settings.js` is the console screen,
 * built like every add-on screen, with the host's React and parts left to the
 * published shims.
 */
export const OUTPUT = {
  frame: 'dist/frame.js',
  pages: { 'google-reviews-settings': 'dist/pages/settings.js' },
} as const;

export const BUILT_FILES: readonly string[] = [OUTPUT.frame, ...Object.values(OUTPUT.pages)];

function screens(): Plugin {
  const shim = (name: string): string => fileURLToPath(new URL(`../../node_modules/@adminium/add-on-contracts/dist/runtime/${name}.js`, import.meta.url));
  return {
    name: 'add-on-google-reviews:screens',
    apply: 'build',
    async closeBundle() {
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
          emptyOutDir: false,
          outDir: 'dist/pages',
          lib: { entry: 'src/pages/settings/index.tsx', formats: ['es'], fileName: () => 'settings.js' },
          rollupOptions: { external: [], output: { inlineDynamicImports: true } },
          target: 'es2022',
          sourcemap: false,
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [screens()],
  build: {
    lib: { entry: 'src/frame/index.ts', formats: ['iife'], name: 'adminiumGoogleReviews', fileName: () => 'frame.js' },
    rollupOptions: { external: [] },
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**'],
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
