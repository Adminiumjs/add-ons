import { defineConfig } from 'vitest/config';

/**
 * ONE BUILT FILE: the server half (`card-terminal@1`), self-contained ES for
 * the engine's `import()`, with no sourcemap.
 *
 * `manifest.json` names `dist/server.js` as the `card-terminal@1` half, and
 * nothing else: this add-on has no screens of its own.
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
