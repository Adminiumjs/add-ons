import { defineConfig } from 'vitest/config';

/**
 * ONE FILE, AND THE NAME THE MANIFEST GIVES IT.
 *
 * This add-on fills no slot. What it builds is the file that decides: which
 * rows a posting makes (`rows`) and what an order's reductions come to
 * (`adjust`). The manifest names that one file twice in `addOn.provides`, once
 * for each contract.
 *
 * THAT FILE IS A CLASSIC SCRIPT. Adminium never imports it: it compiles the
 * bytes and runs them in a bare context made for the one call, with no clock,
 * no randomness, no network and no module loader. So the build is CommonJS
 * with everything inlined (`external: []`), and its one export is the default
 * one, which Rollup writes as `module.exports = …` — the assignment the
 * runner reads. `package.json` keeps `"type": "module"`, which is why nothing
 * here ever `require()`s the built file either: the suites load it the way
 * the runner does (`src/testing/vm.ts`).
 *
 * `manifest.json` points at built files, and this map is the single source of
 * truth for the name: the build writes it, `manifest.test.ts` asserts the
 * manifest uses exactly it, and `dist.test.ts` asserts it landed on disk.
 */
export const OUTPUT = {
  /** Built from `src/server.ts` — the `posting-rows@1` and the `price-adjust@1` provider. */
  server: 'dist/server.js',
} as const;

/** Every file the build writes, as the manifest names them. */
export const BUILT_FILES: readonly string[] = [OUTPUT.server];

export default defineConfig({
  build: {
    lib: {
      entry: 'src/server.ts',
      formats: ['cjs'],
      fileName: () => 'server.js',
    },
    rollupOptions: { external: [], output: { exports: 'default' } },
    target: 'es2022',
    /*
     * NO SOURCEMAP. A map is a second file the manifest does not name, and it
     * would carry the sources' own comments into a package whose every byte is
     * swept for words that may not ship.
     */
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
