import { defineConfig } from 'vitest/config';

/**
 * ONE BUILT FILE: the server half (`card-terminal@1`), self-contained ES for
 * the engine's `import()`, with no sourcemap.
 *
 * Private until it has its manifest, words and listing: for now it proves
 * its transport against Square's sandbox, nothing more.
 */
export const OUTPUT = { server: 'dist/server.js' } as const;

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
