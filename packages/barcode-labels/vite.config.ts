import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * ONE HALF, AND THE FILENAME THE MANIFEST NAMES.
 *
 * Two of the add-ons in this repository build a client bundle and a server one,
 * because they hold a credential and 24 D15 says a credential never reaches a
 * browser. This one builds a single file, and the missing half is a decision
 * rather than an omission — the same three sentences `holiday-calendars` writes,
 * and true here for the same reasons:
 *
 *   IT HAS NO CREDENTIAL. `connect: { kind: "none" }`, no `secret: true`
 *   setting, nothing that would have to be kept out of a page.
 *
 *   IT HAS NO EGRESS. No `network.allow`, no `outbound-http` capability, and
 *   nobody to call. Every symbol it draws is drawn from tables compiled into
 *   this bundle.
 *
 *   SO IT HAS NO DEMO TRANSPORT EITHER. `demoTransport` exists so that an
 *   add-on which would otherwise make a real third-party call in a demo can
 *   make a stand-in one instead (24 D11). There is no call here to stand in
 *   for, and an empty server module written so the manifest could carry the
 *   field would be a module that exists to satisfy a schema.
 *
 * WHAT WOULD CHANGE IT: a code allocated by somebody else. A shop that wanted
 * a real, globally unique article number buys a company prefix from a numbering
 * authority and is issued a range; an add-on that FETCHED the next number from
 * one would need both halves back, and would stop being this add-on. See the
 * README — the whole claim is that the shop types a number it already owns and
 * this draws it correctly.
 *
 * `manifest.json` points at built files, and this map is the single source of
 * truth for the name: the build writes it, `manifest.test.ts` asserts the
 * manifest uses exactly it, and `dist.test.ts` asserts it landed on disk.
 */
export const OUTPUT = {
  /** Built from `src/index.ts` — everything there is. */
  client: 'dist/client.js',
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
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/, /^lucide-react($|\/)/];

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
  plugins: [react()],
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
