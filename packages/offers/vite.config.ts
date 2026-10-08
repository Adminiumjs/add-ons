import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
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
  /** The screens that are code, each built from `src/pages/<name>/index.tsx` into a file of its own. */
  pages: {
    'offers-discounts': 'dist/pages/discounts.js',
    'offers-look-up': 'dist/pages/look-up.js',
    'offers-issue': 'dist/pages/issue.js',
    'offers-rules': 'dist/pages/rules.js',
  },
} as const;

/** Every file the build writes, as the manifest names them. */

/**
 * THE SCREENS, ONE FILE EACH — built after the server file, in the same
 * `vite build`.
 *
 * A screen is served from an address of its own, behind its page's
 * permission, and nothing beside it can be fetched from there. So each is a
 * build of its own with everything inlined: two screens sharing a chunk would
 * be two files importing a third that no address serves. The same goes for
 * its words — every language rides inside the screen's one file.
 *
 * WHAT IS NOT INLINED IS THE HOST. React, the dashboard's parts, its router
 * and its query cache must each be the one running copy, so those specifiers
 * are pointed at the published shims, which read the host when the module
 * loads. The shims themselves ARE inlined: a bare import left in the file
 * would be resolved by the browser against an address that does not exist.
 */
/** Every file the build writes, as the manifest names them. */
export const BUILT_FILES: readonly string[] = [OUTPUT.server, ...Object.values(OUTPUT.pages)];

function screens(): Plugin {
  const shim = (name: string): string => fileURLToPath(new URL(`../../node_modules/@adminium/add-on-contracts/dist/runtime/${name}.js`, import.meta.url));
  return {
    name: 'add-on-offers:screens',
    apply: 'build',
    async closeBundle() {
      for (const file of Object.values(OUTPUT.pages)) {
        const name = file.slice('dist/pages/'.length, -'.js'.length);
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
            // The server file is already in `dist/`: emptying it here would delete what this sits beside.
            emptyOutDir: false,
            outDir: 'dist/pages',
            lib: { entry: `src/pages/${name}/index.tsx`, formats: ['es'], fileName: () => `${name}.js` },
            rollupOptions: { external: [], output: { inlineDynamicImports: true } },
            target: 'es2022',
            sourcemap: false,
          },
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [screens()],
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
    setupFiles: ['src/pages/testing/host.tsx'],
    exclude: ['**/node_modules/**'],
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
