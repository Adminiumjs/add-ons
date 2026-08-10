import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin, type UserConfig } from "vite";

/**
 * THE PACKAGE ROOT, resolved from this file rather than from `process.cwd()`,
 * so the nested build below lands in the same place whether it was started by
 * `npm run build` at the monorepo root or by `built-output.test.ts`.
 *
 * The package directory is what a host installs, so it is also what every path
 * in `manifest.json` is resolved against.
 */
const ROOT = fileURLToPath(new URL(".", import.meta.url));

/**
 * THE TWO ARTEFACTS `manifest.json` NAMES, and the only two this repo emits.
 *
 * THE PATHS ARE WRITTEN THE WAY EVERY ADD-ON IN THIS REPO WRITES THEM:
 * relative to the PACKAGE ROOT, `dist/` and all, so that a reader comparing
 * three manifests sees one convention instead of three. The strings did not
 * change when the three repos became one — `dist/client.js` is still
 * `dist/client.js` — but what they are relative to did, from the root of a
 * standalone repo to the root of this package, which is the directory a host
 * installs and therefore the only thing a manifest path can sanely mean.
 *
 * `dist/client.js` is what every `addOn.slots[].client` points at, because the
 * host serves ONE bundle per add-on from its own origin at
 * `/add-ons/design-studio/client.js` (24 §5.7 item 2) and `import()`s it
 * lazily. The manifest used to name a file per slot — `client/artwork-tile.js`,
 * `client/editor-route.js` — which no build ever produced and which §5.7
 * contradicts anyway; one bundle registers both fills.
 *
 * `dist/server.js` is `provides[0].server`, and it is a genuinely separate
 * rollup pass rather than a second entry in the same one. That matters more
 * than it looks: two entries in ONE lib build share their common modules
 * through a third, hash-named chunk, and the client half then stops being the
 * single ESM bundle D7 requires. Two passes duplicate the engine into both
 * files, which is the trade D7 asks for. The SOURCE keeps its descriptive name,
 * `src/server/artwork-source.ts` — it says which contract it implements, and
 * `add-ons.sh` names that path in its never-vendor list.
 */
export const CLIENT_BUNDLE = "client.js";
export const SERVER_HALF = "server.js";

/**
 * Emits the server half after the client bundle is written.
 *
 * `configFile: false` is load-bearing — it stops the nested build from reading
 * this file and mounting this plugin again, which would recurse forever. It
 * also means the nested pass gets NO React plugin, which is exactly right: the
 * server half has no JSX in it, and if it ever grows some the build will fail
 * rather than quietly ship a renderer in the half that must not render.
 */
function serverHalf(): Plugin {
  return {
    name: "design-studio:server-half",
    apply: "build",
    async closeBundle() {
      await build({
        configFile: false,
        root: ROOT,
        logLevel: "warn",
        build: {
          // The client pass empties `dist/` before it writes; this one runs
          // afterwards, into the SAME directory, so it must not empty anything
          // itself.
          outDir: "dist",
          emptyOutDir: false,
          lib: {
            entry: "src/server/artwork-source.ts",
            formats: ["es"],
            fileName: () => SERVER_HALF,
          },
          minify: "esbuild",
          target: "es2022",
          // No sourcemap, here or in the client pass below. A `.map` carries
          // every source file verbatim into `dist/`, which would drag the whole
          // repo's comments into the published artefact the release sweep greps
          // — `built-output.test.ts` fails if one ever appears.
          sourcemap: false,
        },
      });
    },
  };
}

/*
 * An add-on's client half builds to a SINGLE ESM bundle (24 D7), which is what
 * the host `import()`s from `/add-ons/design-studio/client.js` once the
 * server-side installer lands (§5.7 item 2). Until then the demo build inlines
 * it — the same file, a different loader.
 *
 * React, the JSX runtime and the icon set are external because the host already
 * has them: two copies of React in one page is two reconcilers arguing over one
 * DOM tree, and an add-on that ships its own is a design error rather than a
 * size problem. The rule in D7 is stricter than it looks — this add-on takes NO
 * runtime dependency the host does not already have, which is also why `zod`
 * appears only in devDependencies and only inside the conformance suite.
 */
/*
 * TYPED AS VITE'S CONFIG PLUS ONE FIELD, and assigned to a variable before it
 * is handed to `defineConfig`, which is what lets the `test` block below sit in
 * this file at all. Vite's `UserConfig` has no `test` key — vitest's types add
 * one, but importing them here drags in the SECOND copy of vite that vitest
 * carries in its own `node_modules`, and every plugin in the array above then
 * fails to typecheck against the wrong vite's `Plugin`. Naming the shape and
 * passing a variable rather than a literal keeps one vite in the build and
 * still spells the extra field out.
 */
const config: UserConfig & { test: { globalSetup: readonly string[] } } = {
  plugins: [react(), serverHalf()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => CLIENT_BUNDLE,
      // `client.css` beside `client.js`, so the host links one predictable pair
      // rather than a filename derived from whatever the package is called.
      cssFileName: "client",
    },
    cssCodeSplit: false,
    /*
     * Vite's library build minifies identifiers and syntax but deliberately
     * NOT whitespace, so `/* #__PURE__ *\/` annotations survive for whoever
     * bundles this next. The consequence worth knowing: comments in `src/` end
     * up in `dist/client.js`. That is why `i18n/strings.ts` explains the
     * vocabulary ban without writing any of the banned words down.
     */
    minify: "esbuild",
    /*
     * NO SOURCEMAP, stated rather than inherited. Vite's default is already
     * `false`, but a `.map` is the one file that would put every source module
     * — comments, translator notes and all — into `dist/` verbatim, and the
     * release sweep greps built output. `built-output.test.ts` asserts the
     * emitted file list exactly, so turning this on is a red test rather than a
     * quiet leak.
     */
    sourcemap: false,
    rollupOptions: {
      /*
       * `react/jsx-dev-runtime` is on this list even though a production build
       * never reaches for it. It is what `@vitejs/plugin-react` emits whenever
       * `NODE_ENV` is not `production` — under vitest, for instance — and
       * leaving it off meant a non-production build silently INLINED React's
       * development runtime into the bundle, source paths and all. That is a
       * second reconciler in the page (D7) and a pile of React's own vocabulary
       * in an artefact the release sweep greps.
       */
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "lucide-react",
      ],
    },
  },
  /*
   * The suites that assert over `dist/` get ONE production build, run before
   * any worker starts — see `src/testing/dist.ts` for why it is global setup
   * rather than a `beforeAll` in each of them.
   */
  test: {
    globalSetup: ["src/testing/dist.ts"],
  },
};

export default defineConfig(config);
