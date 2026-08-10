import react from "@vitejs/plugin-react";
import { build, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * THE TWO HALVES, AND THE FILENAMES THE MANIFEST NAMES.
 *
 * `manifest.json` points at built files — `addOn.slots[].client` at the client
 * bundle, `addOn.provides[].server` and `addOn.demoTransport` at the server
 * one. Those paths used to name files no build ever produced (`client/…`,
 * `server/…`), which is a manifest that validates and then fails to load. The
 * map below is the single source of truth for both sides: the build writes
 * these names and `manifest.test.ts` asserts the manifest uses exactly them.
 */
export const OUTPUT = {
  /** Built from `src/index.ts` — everything the browser gets. */
  client: "dist/client.js",
  /** Built from `src/server.ts` — the credentialled half, never in a page. */
  server: "dist/server.js",
} as const;

/**
 * The three runtime dependencies the host already has (24 D7), matched by
 * PREFIX rather than by exact name.
 *
 * `react/jsx-runtime` used to be listed and `react/jsx-dev-runtime` was not, so
 * any build that resolved the development runtime — anything with `NODE_ENV`
 * set to something other than `production` — quietly inlined a second copy of
 * React's element factory into the bundle. Two element factories in one page is
 * the class of bug that ends in "element type is invalid", and it also dragged
 * React's own internals string into output this repo greps.
 */
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/, /^lucide-react($|\/)/];

/**
 * Build the server half after the client half, in the same `vite build`.
 *
 * TWO BUILDS RATHER THAN TWO LIB ENTRIES, and the reason is D7: two entries in
 * one Rollup run share their common modules through a generated chunk, so the
 * client would stop being a single self-contained ESM bundle and would start
 * importing a sibling file the manifest does not name. Two runs give two
 * standalone files. `configFile: false` keeps this plugin out of the inner
 * build, so there is no recursion to guard against.
 */
function serverHalf(): Plugin {
  return {
    name: "add-on-shipping-dhl:server-half",
    apply: "build",
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: "warn",
        build: {
          // The client build has already emptied `dist/`; emptying it again
          // here would delete the bundle this one is meant to sit beside.
          emptyOutDir: false,
          lib: {
            entry: "src/server.ts",
            formats: ["es"],
            fileName: () => "server.js",
          },
          rollupOptions: { external: EXTERNAL },
          target: "es2022",
          // NO SOURCEMAP — see the note above `export default`.
          sourcemap: false,
        },
      });
    },
  };
}

/**
 * An add-on's client half builds to a SINGLE ESM bundle (24 D7).
 *
 * React, react-dom and lucide-react are external because the host already has
 * them: an add-on that ships its own React would put two copies of the
 * reconciler in one page, and hooks called across the seam would throw. Those
 * three are the complete list of runtime dependencies this add-on is allowed —
 * needing a fourth is a design error, not a version bump.
 *
 * The config comes from `vitest/config` rather than `vite` so the `test` block
 * below is typed; the build half is ordinary Vite 7 either way.
 *
 * NO SOURCEMAPS IN THE PUBLISHED ARTEFACT, and the reason is the release gate.
 * Both halves used to be built with `sourcemap: true`, which put a 258 KB
 * `client.js.map` and a 67 KB `server.js.map` into `dist/` — and a sourcemap's
 * `sourcesContent` is a VERBATIM COPY of every source file, comments included.
 * So the two largest files in the artefact were the two most likely to carry a
 * banned word, and `dist.test.ts` skipped exactly those two by extension. The
 * choice was to grep them or to stop shipping them; this repo does BOTH, and
 * this line is the first half. A published add-on is two modules a host loads;
 * it is not a debugging session, its sources are public under AGPL-3.0 anyway,
 * and dropping the maps takes the artefact from 470 KB to 144 KB.
 *
 * The second half is in `dist.test.ts`, which no longer exempts `.map` from the
 * grep and asserts no such file exists. Flipping this flag back on therefore
 * turns the suite red rather than quietly re-opening the hole.
 */
export default defineConfig({
  plugins: [react(), serverHalf()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "client.js",
    },
    rollupOptions: {
      external: EXTERNAL,
    },
    target: "es2022",
    sourcemap: false,
  },
  test: {
    // Every engine here is pure and every suite runs headless: the conformance
    // suites drive the transports directly, so nothing needs a DOM.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `dist.test.ts` builds both halves before it greps them.
    testTimeout: 120_000,
    // TWO SUITES NOW NEED `dist/` ON DISK — `dist.test.ts` greps it and
    // `manifest.test.ts` checks the manifest's declared entry points are really
    // there. Each builds it if it is missing, and two `vite build` runs against
    // one `dist/` in parallel would race: the second empties the directory the
    // first is still writing. One file at a time removes the race, and costs a
    // few seconds in a suite whose long pole is the build either way.
    fileParallelism: false,
  },
});
