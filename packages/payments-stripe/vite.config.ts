import { defineConfig } from 'vitest/config';

/**
 * ONE BUILT FILE: the server half.
 *
 * `manifest.json` names `dist/server.js` as the `payment-provider@1` half,
 * and nothing else: this add-on has no screens of its own. The bundle is
 * self-contained ES (no import of anything), written for the engine's
 * `import()`, with no sourcemap (a map's `sourcesContent` would ship every
 * comment verbatim).
 */
export const OUTPUT = { server: 'dist/server.js' } as const;

export const BUILT_FILES: readonly string[] = [OUTPUT.server];

export default defineConfig({
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
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
