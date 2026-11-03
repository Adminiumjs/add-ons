import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * ONE FILE, AND THE NAME THE MANIFEST GIVES IT.
 *
 * Forms runs no code of its own on a server: Adminium draws, checks and keeps
 * every form a stranger fills. What this builds is the staff screens, one
 * page (`forms`) built from `src/pages/forms/index.tsx` into one file. The
 * manifest names it, `manifest.test.ts` asserts it uses exactly this name and
 * `dist.test.ts` that it landed on disk.
 */
export const OUTPUT = {
  pages: {
    forms: 'dist/pages/forms.js',
  },
} as const;

/** Every file the build writes, as the manifest names them. */
export const BUILT_FILES: readonly string[] = Object.values(OUTPUT.pages);

/**
 * THE SCREENS ARE ONE FILE WITH EVERYTHING INLINED.
 *
 * A page is served from one address behind its page's permission, and nothing
 * beside it can be fetched from there, so the builder, the answers, the
 * results and the share tab all ride in the one file, with every language of
 * their words.
 *
 * WHAT IS NOT INLINED IS THE HOST. React and the dashboard's parts must be the
 * one running copy, so those specifiers are pointed at the published shims,
 * which read the host when the module loads. The shims are this package's own
 * copy of the contracts (the version the manifest's floor names), found the
 * way Node finds them from here.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);

export default defineConfig(({ mode }) =>
  mode === 'test'
    ? {
        test: {
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          setupFiles: ['src/pages/testing/host.tsx'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          fileParallelism: false,
        },
      }
    : {
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
          outDir: 'dist/pages',
          emptyOutDir: true,
          lib: { entry: 'src/pages/forms/index.tsx', formats: ['es'], fileName: () => 'forms.js' },
          rollupOptions: { external: [], output: { inlineDynamicImports: true } },
          target: 'es2022',
          /*
           * NO SOURCEMAP. A map is a second file the manifest does not name, and it
           * would carry the sources' own comments into a package whose every byte is
           * swept for words that may not ship.
           */
          sourcemap: false,
        },
      },
);
