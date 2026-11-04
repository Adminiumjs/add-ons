import { createRequire } from 'node:module';

import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * THE FILES THE BUILD WRITES, AND THE NAMES THE MANIFEST AND THE APPS USE.
 *
 * Three kinds of file, built differently because three different places load them:
 *
 * - `check`: the file that answers the design question, built from
 *   `src/check.ts`. Adminium never imports it: it runs its bytes in a bare
 *   context with no clock, no module loader and nothing else, so it is
 *   CommonJS with everything inlined, its one export written as
 *   `module.exports = …`, the assignment Adminium reads.
 * - `pages`: the shop's own screens in the dashboard, one file each, every
 *   language inside, the host's React reached through the published shims
 *   (as every add-on's screens are), from `src/pages/<name>/index.tsx`;
 * - `panels`: the record panels on an app's product and order line, built
 *   the same way from `src/panels/<name>.tsx`, each a file of its own (a
 *   panel's file is served behind its own gates, never a page's);
 * - `browser`: the customer's editor. It is not served by Adminium at all: a
 *   shop app imports `@adminiumjs/add-on-customiser/browser` into its own
 *   customer bundle, at the range it pins, so React stays the app's own and
 *   is left out of this file.
 *
 * `manifest.test.ts` holds the manifest to `OUTPUT.pages`; `dist.test.ts`
 * holds what lands on disk to `BUILT_FILES`.
 */
export const OUTPUT = {
  check: 'dist/check.js',
  pages: { customiser: 'dist/pages/customiser.js' } as Readonly<Record<string, string>>,
  panels: { 'customiser-product': 'dist/panels/product.js', 'customiser-line': 'dist/panels/line.js' } as Readonly<Record<string, string>>,
  browser: 'dist/browser/index.js',
  /** The customer's editor's stylesheet, which the app links beside it. */
  browserCss: 'dist/browser/editor.css',
} as const;

/** Every file the build writes. */
export const BUILT_FILES: readonly string[] = [OUTPUT.check, OUTPUT.browser, OUTPUT.browserCss, ...Object.values(OUTPUT.pages), ...Object.values(OUTPUT.panels)];

/** Where each screen file is built from. */
const SCREENS: readonly { file: string; entry: string }[] = [
  ...Object.values(OUTPUT.pages).map((file) => ({ file, entry: `src/pages/${file.slice('dist/pages/'.length, -'.js'.length)}/index.tsx` })),
  ...Object.values(OUTPUT.panels).map((file) => ({ file, entry: `src/panels/${file.slice('dist/panels/'.length, -'.js'.length)}.tsx` })),
];

/**
 * The host's own copies of React and the dashboard's parts, for the shop's
 * screens: found the way Node finds them from this package.
 */
const shim = (name: string): string => createRequire(import.meta.url).resolve(`@adminium/add-on-contracts/runtime/${name}`);

/**
 * THE LIBRARIES THE PRODUCTION FILES ARE MADE WITH, KEPT TO WORDS THAT SHIP.
 *
 * The record panel that makes the print PDFs and the laser's SVGs carries a
 * font reader (`fontkit`) and a PDF writer (`pdf-lib`) inside it. Every byte
 * of it is swept for the words an add-on may never say, and two things in
 * those libraries trip the sweep without saying anything: the font
 * reader's name for its glyph-shaping steps, a bare `plan`, and packed data
 * written as base64 text, where a slash and two letters fall together. So,
 * in the shop's screens' build only:
 *
 * - the shaping steps' name is spelt `shapingSteps`, the same in every place;
 * - the WOFF2 reader's dictionary, base64 text, is written in the alphabet
 *   that uses `-` and `_` for `+` and `/`, and read back from it;
 * - the PDF writer's fourteen built-in fonts, which the files never use,
 *   are left out (`src/build/standard-fonts.ts`).
 *
 * Nothing they do changes: `dist.test.ts` builds for real and the panels'
 * tests make the files with the same libraries unbuilt.
 */
export function quietLibraries(): Plugin {
  const fontkit = /[\\/]fontkit[\\/]dist[\\/].*\.m?js$/;
  const dictionary = /[\\/]brotli[\\/]dec[\\/]dictionary\.bin\.js$/;
  const dictionaryReader = /[\\/]brotli[\\/]dec[\\/]dictionary-browser\.js$/;
  return {
    name: 'add-on-customiser:quiet-libraries',
    enforce: 'pre',
    transform(code, id) {
      if (fontkit.test(id)) return { code: code.replace(/\bplan\b/g, 'shapingSteps'), map: null };
      if (dictionary.test(id)) return { code: code.replace(/"([A-Za-z0-9+/=]{1000,})"/, (_whole, text: string) => JSON.stringify(text.replace(/\+/g, '-').replace(/\//g, '_'))), map: null };
      if (dictionaryReader.test(id)) return { code: code.replace("base64.toByteArray(require('./dictionary.bin.js'))", "base64.toByteArray(require('./dictionary.bin.js').replace(/-/g, '+').replace(/_/g, '/'))"), map: null };
      return null;
    },
  };
}
const STANDARD_FONTS = new URL('./src/build/standard-fonts.ts', import.meta.url).pathname;

/** The shop's screens, one file each, built after the customer's editor in the same `vite build`. */
function screens(): Plugin {
  return {
    name: 'add-on-customiser:screens',
    apply: 'build',
    async closeBundle() {
      // The design question's answer: one classic script, beside the customer's editor.
      await build({
        configFile: false,
        logLevel: 'warn',
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          lib: { entry: 'src/check.ts', formats: ['cjs'], fileName: () => 'check.js' },
          rollupOptions: { external: [], output: { exports: 'default' } },
          target: 'es2022',
          sourcemap: false,
        },
      });
      for (const { file, entry } of SCREENS) {
        const name = file.slice(file.lastIndexOf('/') + 1, -'.js'.length);
        await build({
          configFile: false,
          logLevel: 'warn',
          plugins: [quietLibraries(), react()],
          resolve: {
            alias: [
              { find: /^@pdf-lib\/standard-fonts$/, replacement: STANDARD_FONTS },
              { find: /^react\/jsx-dev-runtime$/, replacement: shim('jsx-runtime') },
              { find: /^react\/jsx-runtime$/, replacement: shim('jsx-runtime') },
              { find: /^react-dom$/, replacement: shim('react-dom') },
              { find: /^react$/, replacement: shim('react') },
            ],
          },
          build: {
            // The customer's editor is already in `dist/`: emptying it here would delete it.
            emptyOutDir: false,
            outDir: file.slice(0, file.lastIndexOf('/')),
            lib: { entry, formats: ['es'], fileName: () => `${name}.js` },
            rollupOptions: { external: [], output: { inlineDynamicImports: true } },
            target: 'es2022',
            sourcemap: false,
          },
        });
      }
    },
  };
}

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
        plugins: [react(), screens()],
        build: {
          outDir: 'dist',
          emptyOutDir: true,
          lib: { entry: 'src/browser/index.ts', formats: ['es'], fileName: () => 'browser/index.js', cssFileName: 'browser/editor' },
          rollupOptions: {
            // The app that imports the editor brings React; its bundle holds the one copy.
            external: [/^react($|\/)/, /^react-dom($|\/)/],
          },
          target: 'es2022',
          /*
           * NO SOURCEMAP. A map is a file nobody names, and it would carry the
           * sources' own comments into a package whose every byte is swept for
           * words that may not ship.
           */
          sourcemap: false,
        },
      },
);
