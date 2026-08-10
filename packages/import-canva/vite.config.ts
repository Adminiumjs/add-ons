import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin } from "vite";

/**
 * THE TWO HALVES, AND THE FILENAMES THE MANIFEST NAMES.
 *
 * `manifest.json` points at built files — `addOn.slots[].client` at the client
 * bundle, `addOn.provides[].server` and `addOn.demoTransport` at the server
 * one — and the installer loads exactly those paths. The map below is the
 * single source of truth for both sides: the build writes these names and
 * `manifest.test.ts` asserts the manifest uses exactly them, so the two cannot
 * drift into a manifest that validates and then fails to load.
 *
 * The paths are RELATIVE TO THE PACKAGE ROOT, `dist/…` — the package directory
 * is what a host installs, so it is the only thing a manifest path can sanely
 * be relative to. This add-on used to name `client/client.js` and
 * `server/artwork-source.js`: a third spelling of the same idea, and one that
 * read as if `dist/` were the install root in some places and not in others.
 * One shape across the shelf is worth more than any of the three.
 */
export const OUTPUT = {
  /** Built from `src/index.ts` — everything a page gets. */
  client: "dist/client.js",
  /** Built from `src/server.ts` — the artwork source and the demo transport. */
  server: "dist/server.js",
  /** Emitted beside the client bundle; the host links the pair. */
  clientCss: "dist/client.css",
} as const;

/**
 * React, its DOM renderer and the icon set are `external` because the host
 * already ships them: an add-on takes no runtime dependency the host does not
 * have (D7), and bundling a second React would put two copies of the reconciler
 * in one page — the slot fills render inside the HOST's React tree (§5.7.3), so
 * they must share its instance or hooks throw on mount.
 *
 * `react/jsx-dev-runtime` is matched alongside the production one on purpose: a
 * build that somehow ran in development mode would otherwise INLINE React's
 * development runtime instead of importing it. Matching by PREFIX rather than
 * by exact name is what stops the next such subpath from slipping through.
 */
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/, /^lucide-react($|\/)/];

/**
 * Build the server half after the client half, inside the same `vite build`.
 *
 * TWO ROLLUP RUNS RATHER THAN TWO LIB ENTRIES, and the reason is D7: an add-on's
 * client half builds to a SINGLE ESM bundle. Two entries in one run share their
 * common modules through a generated chunk, so the client would stop being
 * self-contained and would start importing a sibling file the manifest does not
 * name — and the host loads only what the manifest names. Two runs duplicate
 * the import engine and the strings into both files, which is the trade D7
 * asks for.
 *
 * `configFile: false` keeps this plugin out of the inner build, so there is no
 * recursion to guard against.
 */
function serverHalf(): Plugin {
  return {
    name: "add-on-import-canva:server-half",
    apply: "build",
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: "warn",
        build: {
          // The client build has already emptied `dist/`; emptying it again
          // would delete the bundle this one is meant to sit beside.
          emptyOutDir: false,
          lib: {
            entry: "src/server.ts",
            formats: ["es"],
            fileName: () => "server.js",
          },
          rollupOptions: { external: EXTERNAL },
          target: "es2022",
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serverHalf()],
  build: {
    // Comments survive a library build, which is why the release grep reads
    // `dist/` and not only the sources — see `built-output.test.ts`.
    lib: {
      // Relative to the config's own directory — no `node:` import, so this
      // file typechecks without pulling Node's types into the shipped half.
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "client.js",
      // `client.css` beside `client.js`, so the host links one predictable
      // pair rather than a filename derived from whatever the package is
      // called. In demo mode the host builds this add-on from source and its
      // own Vite run inlines the CSS; in connected mode (Phase B) the host
      // serves both from its own origin under `/add-ons/import-canva/`,
      // SRI-checked against the hashes recorded at install.
      cssFileName: "client",
    },
    cssCodeSplit: false,
    rollupOptions: { external: EXTERNAL },
    target: "es2022",
  },
});
