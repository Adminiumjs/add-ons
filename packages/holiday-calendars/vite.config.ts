import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * ONE HALF, AND THE FILENAME THE MANIFEST NAMES.
 *
 * Every other add-on in this repository builds TWO bundles — a client half for
 * the browser and a server half holding whatever must never reach one. This one
 * builds a single file, and the missing half is the most important decision in
 * the package rather than an omission:
 *
 *   IT HAS NO CREDENTIAL. `connect: { kind: "none" }`, no `secret: true`
 *   setting, nothing to keep out of a page.
 *
 *   IT HAS NO EGRESS. No `network.allow`, no `outbound-http` capability, and no
 *   third party to reach — the day-sets are DATA compiled into this bundle.
 *
 *   SO IT HAS NO DEMO TRANSPORT EITHER. `demoTransport` exists because 24 D11
 *   forbids a real third-party call in a demo, and an add-on that would
 *   otherwise make one needs a stand-in that does not. There is no call here to
 *   stand in for. Shipping an empty server module so the manifest could carry
 *   the field would be a module that exists to satisfy a schema, and the schema
 *   makes both fields optional precisely so it does not have to.
 *
 * What would change this: an add-on that FETCHED a day-set from anywhere would
 * need both halves back, and would also stop being this product. See the
 * README — the whole claim is that the data is in the bundle you already have.
 *
 * `manifest.json` points at built files, and this map is the single source of
 * truth for the name: the build writes it, `manifest.test.ts` asserts the
 * manifest uses exactly it, and `dist.test.ts` asserts it landed on disk.
 */
export const OUTPUT = {
  /** Built from `src/index.ts` — everything there is. */
  client: "dist/client.js",
} as const;

/**
 * The runtime dependencies the host already has (24 D7), matched by PREFIX
 * rather than by exact name.
 *
 * `lucide-react` is on the list even though this add-on imports no icon: the
 * externals list says what a bundle may not INLINE, and a list that shrinks to
 * fit today's imports is a list that silently stops protecting the day somebody
 * adds one. The prefix form is what keeps `react/jsx-dev-runtime` — the
 * development element factory a non-production build resolves — from being
 * quietly inlined beside the production one.
 */
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/, /^lucide-react($|\/)/];

/**
 * An add-on's client half builds to a SINGLE ESM bundle (24 D7).
 *
 * React is external because the host already has it: an add-on that shipped its
 * own would put two copies of the reconciler in one page, and hooks called
 * across the seam would throw.
 *
 * NO SOURCEMAPS IN THE PUBLISHED ARTEFACT. A sourcemap's `sourcesContent` is a
 * VERBATIM COPY of every source file, comments included — so the largest file
 * in the artefact would be the one most likely to carry a word the release
 * sweep bans, and the one a grep over `dist/` is most tempted to skip by
 * extension. That is not a hypothetical: it is what `packages/shipping-dhl`
 * shipped until somebody grepped the built output by hand. `dist.test.ts` here
 * asserts no `.map` exists, so flipping this flag back on turns the suite red
 * rather than quietly re-opening the hole.
 */
export default defineConfig({
  plugins: [react()],
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
    // Every engine here is pure and every suite runs headless: the panel is
    // rendered with `renderToStaticMarkup`, which needs no DOM.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // `dist.test.ts` builds the bundle before it greps it.
    testTimeout: 120_000,
    // TWO SUITES NEED `dist/` ON DISK — `dist.test.ts` greps it and
    // `manifest.test.ts` checks the manifest's declared entry point is really
    // there. Each builds it if it is missing, and two `vite build` runs against
    // one `dist/` in parallel would race: the second empties the directory the
    // first is still writing.
    fileParallelism: false,
  },
});
