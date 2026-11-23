import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * TWO FILES, AND THE NAMES THE MANIFEST GIVES THEM. `dist/server.js` is the
 * `calendar-provider@1` half, one self-contained ES file for the engine's
 * `import()`. `dist/pages/settings.js` is the console screen, built like every
 * add-on screen, with the host's React and parts left to the published shims.
 * Neither has a sourcemap, so no comment ships.
 */
export const OUTPUT = { server: 'dist/server.js', pages: { 'calendar-google-settings': 'dist/pages/settings.js' } } as const;

export const BUILT_FILES: readonly string[] = [OUTPUT.server, ...Object.values(OUTPUT.pages)];

function screens(): Plugin {
  const shim = (name: string): string => fileURLToPath(new URL(`../../node_modules/@adminium/add-on-contracts/dist/runtime/${name}.js`, import.meta.url));
  return {
    name: 'add-on-calendar:screens',
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
    lib: { entry: 'src/server.ts', formats: ['es'], fileName: () => 'server.js' },
    rollupOptions: { external: [] },
    target: 'es2022',
    sourcemap: false,
    minify: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
