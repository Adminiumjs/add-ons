import { fileURLToPath } from "node:url";
import { build, type Plugin, type PluginOption } from "vite";
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The host-runtime shims this add-on's React imports are aliased to (26-T13). */
const HOST_RUNTIME_REACT = fileURLToPath(
  new URL("../host/src/runtime/react.ts", import.meta.url),
);
const HOST_RUNTIME_JSX = fileURLToPath(
  new URL("../host/src/runtime/jsx-runtime.ts", import.meta.url),
);


/**
 * TWO HALVES, AND THE FILENAMES THE MANIFEST NAMES.
 *
 * [Amended 2026-09-10 by 34-T06.] This used to build ONE file, with three
 * sentences borrowed from `holiday-calendars` explaining why the second half
 * would have been a module written to satisfy a schema. Every one of those
 * sentences is STILL TRUE and none of them has been deleted — read them below
 * before adding anything to `server.ts`, because they still say what may not
 * go in it. What changed is not the reasoning; it is that a second half now
 * has a job those sentences never contemplated.
 *
 *   IT STILL HAS NO CREDENTIAL. `connect: { kind: "none" }`, no `secret: true`
 *   setting, nothing that would have to be kept out of a page.
 *
 *   IT STILL HAS NO EGRESS. No `network.allow`, no `outbound-http` capability,
 *   and nobody to call. Every symbol it draws is drawn from tables compiled
 *   into these bundles.
 *
 *   SO IT STILL HAS NO DEMO TRANSPORT. `demoTransport` exists so that an
 *   add-on which would otherwise make a real third-party call in a demo can
 *   make a stand-in one instead (24 D11). There is no call here to stand in
 *   for, and the manifest still does not carry the field.
 *
 * WHAT THE SERVER HALF IS FOR, THEN: it is the entry point ADMINIUM loads when
 * a document profile names this add-on — `addOn.provides[].server`, resolved
 * in the engine's `document.render` job, which never runs in a page. A
 * provider that lived only in `client.js` could not be reached from there at
 * all. It is not a place to keep a secret; it is a place the server can import
 * from.
 *
 * WHAT WOULD CHANGE THE REST: a code allocated by somebody else. A shop that
 * wanted a real, globally unique article number buys a company prefix from a
 * numbering authority and is issued a range; an add-on that FETCHED the next
 * number from one would need a credential and an egress list, and would stop
 * being this add-on. See the README — the whole claim is that the shop types a
 * number it already owns and this draws it correctly.
 *
 * `manifest.json` points at built files, and this map is the single source of
 * truth for the name: the build writes it, `manifest.test.ts` asserts the
 * manifest uses exactly it, and `dist.test.ts` asserts it landed on disk.
 */
export const OUTPUT = {
  /** Built from `src/index.ts` — everything a browser gets. */
  client: 'dist/client.js',
  /** Built from `src/server.ts` — the `document-render@1` provider (34-T06). */
  server: 'dist/server.js',
} as const;

/**
 * The runtime dependencies the host already has (24 D7), matched by PREFIX
 * rather than by exact name.
 *
 * `lucide-react` is on the list even though this add-on imports no icon: the
 * externals list says what a bundle may not INLINE, and a list trimmed to
 * today's imports is a list that silently stops protecting the day somebody
 * adds one. The prefix form is what keeps `react/jsx-dev-runtime` — the
 * development element factory a non-release build resolves — from being
 * quietly inlined beside the ordinary one.
 */
const EXTERNAL: never[] = [];

/**
 * Build the server half after the client half, in the same `vite build`.
 *
 * TWO BUILDS RATHER THAN TWO LIB ENTRIES, and the reason is D7: two entries in
 * one Rollup run share their common modules through a generated chunk, so the
 * client would stop being a single self-contained ESM bundle and would start
 * importing a sibling file the manifest does not name. `sheet.ts` and
 * `codes.ts` are reached from BOTH entries here, so this is not hypothetical —
 * one Rollup run would certainly hoist them. Two runs give two standalone
 * files. `configFile: false` keeps this plugin out of the inner build, so
 * there is no recursion to guard against.
 *
 * NO REACT ALIAS ON THIS ONE, deliberately. The server half imports no React
 * and must not: it is loaded by Node in the engine's job runner, where the
 * host-runtime shim's global does not exist and reading it would throw at
 * module init.
 */
function serverHalf(): Plugin {
  return {
    name: "add-on-invoices:server-half",
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
 * THE DASHBOARD PAGE — a third half, and the only one that runs inside
 * Adminium's own shell rather than an app's.
 *
 * It is built apart from `client.js` because what it may not inline is a
 * different list. The slot fills borrow only React from their host; a page
 * borrows the UI kit, the router, the query client and the host's own helpers
 * as well, because it renders INSIDE the dashboard and every one of those has
 * to be the single running copy. Two react-query caches behind one provider is
 * a screen that hangs with nothing in the console.
 *
 * TWO HALVES OF THE RECIPE, BOTH LOAD-BEARING. `resolve.alias` points each real
 * specifier at the published shim, and `external` keeps the shims themselves
 * out of the bundle so the HOST's copy is what runs. Alias without external
 * inlines the shim and it reads the host global at the wrong time; external
 * without alias leaves a bare `react` import no browser can resolve.
 */
function dashboardPage(): Plugin {
  /*
   * The shim's FILE, not its package specifier — and this is the whole
   * difference between a page that loads and one that 404s.
   *
   * A bundle is served from `/api/v1/add-ons/<key>/bundle/…` and imported by
   * URL. A bare `import … from "@adminium/add-on-contracts/runtime/ui"` left in
   * it would be resolved by the BROWSER, relative to that URL, against a path
   * that does not exist — and no import map is in play. Node resolves it fine,
   * which is exactly how a test can pass while the real thing is broken.
   *
   * So the shims are INLINED. They are a few lines each that read the host's
   * global, so inlining costs nothing and the bundle ends up importing
   * nothing at all — the rule every other add-on here already follows, and
   * which `release-shape.test.ts` enforces across the repository.
   */
  const shim = (name: string): string =>
    fileURLToPath(
      new URL(`../../node_modules/@adminium/add-on-contracts/dist/runtime/${name}.js`, import.meta.url),
    );
  return {
    name: "add-on-invoices:dashboard-page",
    apply: "build",
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: "warn",
        plugins: [react()],
        resolve: {
          alias: [
            { find: /^react\/jsx-dev-runtime$/, replacement: shim("jsx-runtime") },
            { find: /^react\/jsx-runtime$/, replacement: shim("jsx-runtime") },
            { find: /^react-dom$/, replacement: shim("react-dom") },
            { find: /^react$/, replacement: shim("react") },
            { find: /^@adminium\/ui$/, replacement: shim("ui") },
            { find: /^@adminium\/i18n$/, replacement: shim("i18n") },
            { find: /^@tanstack\/react-router$/, replacement: shim("router") },
            { find: /^@tanstack\/react-query$/, replacement: shim("query") },
          ],
        },
        build: {
          emptyOutDir: false,
          lib: {
            entry: "src/page/index.tsx",
            formats: ["es"],
            fileName: () => "page.js",
          },
          rollupOptions: {
            // NOTHING is external: see the note on `shim` above. What the host
            // provides arrives through the global the shims read, not through
            // an import the browser would have to resolve.
            external: [],
          },
          target: "es2022",
          sourcemap: false,
        },
      });
    },
  };
}

/**
 * The React aliases, applied to the BUILD ONLY (26-T13).
 *
 * A top-level `resolve.alias` would apply to vitest as well, because vitest
 * reads this same config — and then the add-on's own source would resolve
 * `react` to the shim during tests, which throws at module init because no HOST
 * provided a runtime. Tests must render against the real React; only the
 * artefact a browser loads needs the shim.
 *
 * `apply: "build"` is what draws that line, and it is the whole reason this is
 * a plugin rather than three lines of config.
 */
function hostRuntimeAlias(): PluginOption {
  return {
    name: "adminium:host-runtime-alias",
    apply: "build",
    config: () => ({
      resolve: {
        /*
         * ANCHORED REGEXES IN THE ARRAY FORM. Vite's object aliases match by
         * PREFIX, so a `react` key also swallows `react/jsx-runtime` and
         * resolves it to `<…>/react.ts/jsx-runtime` — an ENOTDIR nobody would
         * read as "your alias was too greedy".
         */
        alias: [
          { find: /^react\/jsx-dev-runtime$/, replacement: HOST_RUNTIME_JSX },
          { find: /^react\/jsx-runtime$/, replacement: HOST_RUNTIME_JSX },
          { find: /^react$/, replacement: HOST_RUNTIME_REACT },
        ],
      },
    }),
  };
}


/**
 * An add-on's client half builds to a SINGLE ESM bundle (24 D7).
 *
 * React is external because the host already has it: an add-on shipping its own
 * would put two copies of the reconciler in one page, and hooks called across
 * the seam would throw.
 *
 * NO SOURCEMAPS IN THE PUBLISHED ARTEFACT. A sourcemap's `sourcesContent` is a
 * VERBATIM COPY of every source file, comments included — so the largest file
 * in the artefact would be the one most likely to carry a word the release
 * sweep bans, and the one a grep over `dist/` is most tempted to skip by
 * extension. That is not hypothetical: it is what `packages/shipping-dhl`
 * shipped until somebody grepped the built output by hand. `dist.test.ts` here
 * asserts no `.map` exists, so flipping this flag back on turns the suite red
 * rather than quietly re-opening the hole.
 */
export default defineConfig({
  plugins: [hostRuntimeAlias(), react(), serverHalf(), dashboardPage()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'client.js',
    },
    rollupOptions: {
      external: EXTERNAL,
    },
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    // Every engine here is pure and every suite runs headless: both surfaces
    // are rendered with `renderToStaticMarkup`, which needs no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    /*
     * THE MOVED PAGE'S OWN TESTS ARE HERE AND ARE NOT RUN YET.
     *
     * All ten came across with the surface and they are worth keeping — they
     * are the coverage that screen had in the engine. They cannot run in this
     * package yet: every one of them renders through the DASHBOARD's harness
     * (`@testing-library/react`, its `app/query.js`, `app/router.js`,
     * `i18n/testing.js` and `test/fixtures.js`), and this suite is headless
     * `node` with none of that. Building that harness here is the next step of
     * the move; excluding them says so out loud rather than deleting the files
     * and quietly losing what they check.
     */
    exclude: ['src/page/**/*.test.ts', 'src/page/**/*.test.tsx', '**/node_modules/**'],
    // `dist.test.ts` builds the bundle before it greps it.
    testTimeout: 120_000,
    // TWO SUITES NEED `dist/` ON DISK — `dist.test.ts` greps it and
    // `manifest.test.ts` checks the entry points the manifest declares are
    // really there. Each builds it if it is missing, and two `vite build` runs
    // against one `dist/` in parallel would race: the second empties the
    // directory the first is still writing.
    fileParallelism: false,
  },
});
