import { defineConfig } from 'vitest/config';

/**
 * ONE BUILT FILE: the server half.
 *
 * `manifest.json` names `dist/server.js` as the `payment-provider@1` half,
 * and nothing else: this add-on has no screens of its own. The bundle is ES,
 * written for the engine's `import()`, with no sourcemap. It imports exactly
 * two Node modules, `node:crypto` and `node:tls`, to check the certificate
 * a PayPal webhook is signed with against the system's trusted roots; the
 * engine runs on Node, and nothing else is imported.
 */
export const OUTPUT = { server: 'dist/server.js' } as const;

export const BUILT_FILES: readonly string[] = [OUTPUT.server];

/** The only modules the built file may import. */
export const NODE_IMPORTS = ['node:crypto', 'node:tls'] as const;

export default defineConfig({
  build: {
    lib: { entry: 'src/server.ts', formats: ['es'], fileName: () => 'server.js' },
    rollupOptions: { external: [...NODE_IMPORTS] },
    target: 'node22',
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
