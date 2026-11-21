import { defineConfig } from 'vitest/config';

/**
 * THE SERVER HALF: one self-contained ES file for the engine's `import()`,
 * with no sourcemap, so no comment ships.
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
  },
});
